'use strict';

const { PLUGIN_ID, CONTENT_MANAGER_PLUGIN } = require('./utils/constants');

/**
 * Shows the declared required image size as hint text under media fields in the
 * Content Manager edit view — for fields on the content-type itself AND for
 * fields nested inside components / dynamic zones.
 *
 * Mechanism (server-only, works on Strapi v4 and v5):
 * the admin edit view fetches its layout from the content-manager. The Upload
 * plugin's media input renders `metadatas[field].edit.description` as a hint.
 * So we fill that description from a field's
 *   pluginOptions: { 'image-placeholder': { requiredSize: '1200x630' } }
 * (only when the field has no manually configured description).
 *
 * Two different code paths build that layout, so we wrap both:
 *   - content-type fields  -> `content-types` service `findConfiguration()`
 *   - component fields      -> `components` service `findComponentsConfigurations()`
 *     (in Strapi 5.x this batch-loads configs from the store and never calls
 *      `findConfiguration`, so wrapping only the latter misses components).
 */
module.exports = (strapi, { showRequiredSizeHint, sizeHintTemplate }) => {
  if (!showRequiredSizeHint) {
    return;
  }

  const cmPlugin = strapi.plugin(CONTENT_MANAGER_PLUGIN);
  if (!cmPlugin) {
    strapi.log.warn(
      '[image-placeholder] content-manager plugin not found; required-size hints disabled.'
    );
    return;
  }

  const ctService = safeService(cmPlugin, 'content-types');
  const componentService = safeService(cmPlugin, 'components');

  // --- content-type level fields --------------------------------------------
  if (ctService && typeof ctService.findConfiguration === 'function') {
    wrap(ctService, 'findConfiguration', (original) => async function (schema, ...rest) {
      const configuration = await original(schema, ...rest);
      tryInject(strapi, () => injectSizeHints(schema, configuration, sizeHintTemplate));
      return configuration;
    });
  }

  // --- component / dynamic-zone fields --------------------------------------
  if (componentService && typeof componentService.findComponentsConfigurations === 'function') {
    wrap(componentService, 'findComponentsConfigurations', (original) =>
      async function (model, ...rest) {
        const map = await original(model, ...rest);
        tryInject(strapi, () => {
          for (const [uid, entry] of Object.entries(map || {})) {
            const componentSchema = strapi.components && strapi.components[uid];
            if (componentSchema) {
              injectSizeHints(componentSchema, entry, sizeHintTemplate);
            }
          }
        });
        return map;
      }
    );
  }

  // Also wrap the single-component findConfiguration for completeness (some
  // flows / older versions call it directly).
  if (componentService && typeof componentService.findConfiguration === 'function') {
    wrap(componentService, 'findConfiguration', (original) => async function (component, ...rest) {
      const configuration = await original(component, ...rest);
      const schema = (strapi.components && strapi.components[component?.uid]) || component;
      tryInject(strapi, () => injectSizeHints(schema, configuration, sizeHintTemplate));
      return configuration;
    });
  }

  strapi.log.info(
    '[image-placeholder] Required-size hints enabled for media fields (content-types + components).'
  );
};

function safeService(plugin, name) {
  try {
    return plugin.service(name);
  } catch (err) {
    return null;
  }
}

function wrap(target, methodName, factory) {
  if (target[methodName].__imagePlaceholderWrapped) {
    return;
  }
  const original = target[methodName].bind(target);
  const wrapped = factory(original);
  wrapped.__imagePlaceholderWrapped = true;
  target[methodName] = wrapped;
}

function tryInject(strapi, fn) {
  try {
    fn();
  } catch (err) {
    strapi.log.error(`[image-placeholder] failed to inject size hint: ${err.message}`);
  }
}

/**
 * Mutates `configuration.metadatas[field].edit.description` for media fields
 * carrying a requiredSize plugin option. Creates the metadata entry if missing
 * (component configs can come back with empty metadatas).
 */
function injectSizeHints(schema, configuration, template) {
  const attributes = schema && schema.attributes;
  if (!attributes || !configuration) {
    return;
  }

  if (!configuration.metadatas || typeof configuration.metadatas !== 'object') {
    configuration.metadatas = {};
  }
  const metadatas = configuration.metadatas;

  for (const [name, attribute] of Object.entries(attributes)) {
    if (!attribute || attribute.type !== 'media') {
      continue;
    }

    const requiredSize = readRequiredSize(attribute);
    if (!requiredSize) {
      continue;
    }

    const hint = formatSizeHint(requiredSize, template);

    if (!metadatas[name]) {
      metadatas[name] = { edit: {}, list: {} };
    }
    if (!metadatas[name].edit || typeof metadatas[name].edit !== 'object') {
      metadatas[name].edit = {};
    }

    const edit = metadatas[name].edit;

    // Never overwrite a description the user set in "Configure the view".
    if (edit.description && String(edit.description).trim() !== '') {
      continue;
    }

    // Provide sensible defaults if we had to create the entry from scratch.
    if (edit.label === undefined) edit.label = name;
    if (edit.placeholder === undefined) edit.placeholder = '';
    if (edit.visible === undefined) edit.visible = true;
    if (edit.editable === undefined) edit.editable = true;

    edit.description = hint;
  }
}

function readRequiredSize(attribute) {
  const opts =
    attribute.pluginOptions && attribute.pluginOptions[PLUGIN_ID]
      ? attribute.pluginOptions[PLUGIN_ID]
      : null;

  if (!opts) {
    return null;
  }

  const value = opts.requiredSize;
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  return String(value).trim();
}

/**
 * "1200x630" -> "Recommended size: 1200×630px" (via the template).
 * Non WxH strings are passed through as-is into {size}.
 */
function formatSizeHint(requiredSize, template) {
  const match = requiredSize.match(/^(\d+)\s*[x×*]\s*(\d+)$/i);

  if (match) {
    const [, width, height] = match;
    return template
      .replace(/\{width\}/g, width)
      .replace(/\{height\}/g, height)
      .replace(/\{size\}/g, `${width}×${height}`);
  }

  if (template.includes('{size}')) {
    return template.replace(/\{size\}/g, requiredSize);
  }
  return requiredSize;
}

module.exports.injectSizeHints = injectSizeHints;
module.exports.formatSizeHint = formatSizeHint;
