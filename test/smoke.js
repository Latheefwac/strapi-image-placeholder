'use strict';

/* Minimal, dependency-free smoke test that mocks a Strapi instance and
 * verifies the plugin's register logic for both v4 and v5 config namespaces.
 * Run with: npm test  (or: node ./test/smoke.js) */

const assert = require('assert');
const register = require('../server/register');
const { FILE_UID } = require('../server/utils/constants');
const { injectSizeHints, formatSizeHint } = require('../server/decorate-content-manager');

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function makeStrapi({ configNamespace, userConfig }) {
  const dbUpdateCalls = [];

  // Native upload.updateFileInfo: whitelists fields, just like real Strapi.
  const fileRows = { 1: { id: 1, name: 'a.png', alternativeText: null, caption: null } };
  const uploadService = {
    async updateFileInfo(id, { name, alternativeText, caption }) {
      const row = fileRows[id];
      if (name !== undefined) row.name = name;
      if (alternativeText !== undefined) row.alternativeText = alternativeText;
      if (caption !== undefined) row.caption = caption;
      return { ...row };
    },
  };

  const config = {};
  if (configNamespace) config[configNamespace] = userConfig;

  return {
    log: { info() {}, warn() {}, error() {}, debug() {} },
    contentTypes: {
      [FILE_UID]: {
        attributes: {
          name: { type: 'string', configurable: false },
          alternativeText: { type: 'string', configurable: false },
          caption: { type: 'string', configurable: false },
        },
      },
    },
    config: { get: (key) => config[key] },
    plugin: (id) => (id === 'upload' ? { service: () => uploadService } : null),
    db: {
      query: (uid) => ({
        async update({ where, data }) {
          assert.strictEqual(uid, FILE_UID);
          Object.assign(fileRows[where.id], data);
          dbUpdateCalls.push({ where, data });
          return fileRows[where.id];
        },
      }),
    },
    __test: { uploadService, dbUpdateCalls, fileRows },
  };
}

(async () => {
  console.log('image-placeholder smoke test\n');

  // --- v5 namespace, default config -----------------------------------------
  {
    const strapi = makeStrapi({ configNamespace: 'plugin::image-placeholder', userConfig: {} });
    register({ strapi });

    const attr = strapi.contentTypes[FILE_UID].attributes.description;
    assert.ok(attr, 'description attribute should be added');
    assert.strictEqual(attr.type, 'text');
    assert.strictEqual(attr.configurable, true);
    assert.strictEqual(attr.required, false);
    ok('v5: adds default "description" text field, configurable, not required');
  }

  // --- v4 namespace, custom config ------------------------------------------
  {
    const strapi = makeStrapi({
      configNamespace: 'plugin.image-placeholder',
      userConfig: { config: { fieldName: 'altDesc', fieldType: 'string', required: true } },
    });
    register({ strapi });

    const attr = strapi.contentTypes[FILE_UID].attributes.altDesc;
    assert.ok(attr, 'custom field should be added');
    assert.strictEqual(attr.type, 'string');
    assert.strictEqual(attr.required, true);
    ok('v4: reads "plugin.<id>" namespace + custom fieldName/type/required');
  }

  // --- persistence through patched updateFileInfo ---------------------------
  {
    const strapi = makeStrapi({ configNamespace: 'plugin::image-placeholder', userConfig: {} });
    register({ strapi });

    const result = await strapi.__test.uploadService.updateFileInfo(1, {
      name: 'renamed.png',
      description: 'A friendly alt description',
    });

    assert.strictEqual(result.name, 'renamed.png', 'native fields still updated');
    assert.strictEqual(result.description, 'A friendly alt description', 'description merged into result');
    assert.strictEqual(strapi.__test.dbUpdateCalls.length, 1, 'one db update for description');
    assert.deepStrictEqual(strapi.__test.dbUpdateCalls[0].data, { description: 'A friendly alt description' });
    assert.strictEqual(strapi.__test.fileRows[1].description, 'A friendly alt description', 'persisted to row');
    ok('persists description through patched updateFileInfo and keeps native fields');
  }

  // --- no description in payload => no extra db write ------------------------
  {
    const strapi = makeStrapi({ configNamespace: 'plugin::image-placeholder', userConfig: {} });
    register({ strapi });

    await strapi.__test.uploadService.updateFileInfo(1, { caption: 'just a caption' });
    assert.strictEqual(strapi.__test.dbUpdateCalls.length, 0, 'no db write when description absent');
    ok('skips extra db write when description not in payload');
  }

  // --- double register (hot reload) must not double-wrap --------------------
  {
    const strapi = makeStrapi({ configNamespace: 'plugin::image-placeholder', userConfig: {} });
    register({ strapi });
    register({ strapi });
    await strapi.__test.uploadService.updateFileInfo(1, { description: 'x' });
    assert.strictEqual(strapi.__test.dbUpdateCalls.length, 1, 'only one persistence call after double register');
    ok('idempotent: double register does not double-wrap the service');
  }

  // --- reserved field name is rejected --------------------------------------
  {
    const strapi = makeStrapi({
      configNamespace: 'plugin::image-placeholder',
      userConfig: { config: { fieldName: 'caption' } },
    });
    const before = { ...strapi.contentTypes[FILE_UID].attributes.caption };
    register({ strapi });
    assert.deepStrictEqual(
      strapi.contentTypes[FILE_UID].attributes.caption,
      before,
      'native caption attribute untouched'
    );
    ok('refuses to overwrite a reserved native attribute');
  }

  // --- required-size hint: formatting ---------------------------------------
  {
    const tpl = 'Recommended size: {size}px';
    assert.strictEqual(formatSizeHint('1200x630', tpl), 'Recommended size: 1200×630px');
    assert.strictEqual(formatSizeHint('1200×630', tpl), 'Recommended size: 1200×630px');
    assert.strictEqual(formatSizeHint('800 X 600', tpl), 'Recommended size: 800×600px');
    assert.strictEqual(
      formatSizeHint('1024x768', 'W {width} / H {height}'),
      'W 1024 / H 768'
    );
    assert.strictEqual(formatSizeHint('min 800px wide', tpl), 'Recommended size: min 800px widepx');
    ok('size hint: formats WxH and free-form values via template');
  }

  // --- required-size hint: injection into edit metadata ---------------------
  {
    const schema = {
      attributes: {
        title: { type: 'string' },
        image: {
          type: 'media',
          pluginOptions: { 'image-placeholder': { requiredSize: '1200x630' } },
        },
        gallery: { type: 'media' }, // no requiredSize
        banner: {
          type: 'media',
          pluginOptions: { 'image-placeholder': { requiredSize: '300x250' } },
        },
      },
    };
    const configuration = {
      metadatas: {
        title: { edit: { description: '' }, list: {} },
        image: { edit: { description: '' }, list: {} },
        gallery: { edit: { description: '' }, list: {} },
        banner: { edit: { description: 'Custom note set by user' }, list: {} },
      },
    };

    injectSizeHints(schema, configuration, 'Recommended size: {size}px');

    assert.strictEqual(
      configuration.metadatas.image.edit.description,
      'Recommended size: 1200×630px',
      'media field with requiredSize gets the hint'
    );
    assert.strictEqual(
      configuration.metadatas.gallery.edit.description,
      '',
      'media field without requiredSize is untouched'
    );
    assert.strictEqual(
      configuration.metadatas.banner.edit.description,
      'Custom note set by user',
      'user-configured description is never overwritten'
    );
    assert.strictEqual(
      configuration.metadatas.title.edit.description,
      '',
      'non-media field untouched'
    );
    ok('size hint: injects into media fields, respects existing descriptions');
  }

  // --- required-size hint: component config with EMPTY metadatas ------------
  {
    // Mirrors the Strapi 5.x components batch-loader, which can return an entry
    // whose metadatas is {} — the hint must still be created.
    const componentSchema = {
      attributes: {
        photo: {
          type: 'media',
          pluginOptions: { 'image-placeholder': { requiredSize: '640x480' } },
        },
      },
    };
    const entry = { uid: 'shared.card', metadatas: {}, layouts: { edit: [], list: [] } };

    injectSizeHints(componentSchema, entry, 'Recommended size: {size}px');

    assert.ok(entry.metadatas.photo, 'metadata entry created for component media field');
    assert.strictEqual(entry.metadatas.photo.edit.description, 'Recommended size: 640×480px');
    assert.strictEqual(entry.metadatas.photo.edit.label, 'photo', 'sensible default label set');
    assert.strictEqual(entry.metadatas.photo.edit.visible, true);
    ok('size hint: creates entry for component media field with empty metadatas');
  }

  console.log(`\n${passed} checks passed.`);
})().catch((err) => {
  console.error('\nSMOKE TEST FAILED:\n', err);
  process.exit(1);
});
