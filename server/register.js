'use strict';

const { FILE_UID, UPLOAD_PLUGIN, UPLOAD_SERVICE } = require('./utils/constants');
const { getConfig } = require('./utils/get-config');

/**
 * register() runs before Strapi builds the database models and syncs the
 * schema (verified against @strapi/core: register lifecycles run, then
 * `db.init()` / `db.schema.sync()` run during bootstrap). That ordering is the
 * same on Strapi v4 and v5, which is why mutating the in-memory content-type
 * here results in a real database column being created.
 */
module.exports = ({ strapi }) => {
  const { fieldName, fieldType, required } = getConfig(strapi);

  addDescriptionAttribute(strapi, { fieldName, fieldType, required });
  decorateUpdateFileInfo(strapi, { fieldName });
};

/**
 * Step 1 — add the custom attribute to the Media Library file schema so the
 * column is created and the value is automatically exposed through REST and
 * GraphQL like any other field on the asset.
 */
function addDescriptionAttribute(strapi, { fieldName, fieldType, required }) {
  const fileContentType = strapi.contentTypes[FILE_UID];

  if (!fileContentType) {
    strapi.log.warn(
      `[image-placeholder] Could not find "${FILE_UID}". Is the Upload plugin enabled? Skipping field injection.`
    );
    return;
  }

  // Reserved/native attributes we must never overwrite.
  const reserved = ['name', 'alternativeText', 'caption', 'url', 'hash', 'ext', 'mime', 'size'];
  if (reserved.includes(fieldName)) {
    strapi.log.error(
      `[image-placeholder] config.fieldName "${fieldName}" collides with a native file attribute. Choose a different name. Skipping.`
    );
    return;
  }

  if (fileContentType.attributes[fieldName]) {
    // Already present (e.g. defined via src/extensions or a re-run). Leave it.
    strapi.log.debug(
      `[image-placeholder] "${fieldName}" already exists on ${FILE_UID}; leaving it untouched.`
    );
    return;
  }

  fileContentType.attributes[fieldName] = {
    type: fieldType,
    configurable: true,
    required: required === true,
  };

  strapi.log.info(
    `[image-placeholder] Added "${fieldName}" (${fieldType}${required ? ', required' : ''}) to ${FILE_UID}.`
  );
}

/**
 * Step 2 — the Upload service's `updateFileInfo` destructures only
 * `{ name, alternativeText, caption, folder }` on both v4 and v5, so any extra
 * field (our description) is silently dropped on save. We wrap the method so
 * the value is persisted whenever it is present in the payload, then return it
 * merged into the result. This makes the field editable through the standard
 * media update endpoint (admin + content API) and any programmatic call.
 */
function decorateUpdateFileInfo(strapi, { fieldName }) {
  const uploadPlugin = strapi.plugin(UPLOAD_PLUGIN);

  if (!uploadPlugin) {
    strapi.log.warn('[image-placeholder] Upload plugin not available; skipping service decoration.');
    return;
  }

  const service = uploadPlugin.service(UPLOAD_SERVICE);

  if (!service || typeof service.updateFileInfo !== 'function') {
    strapi.log.warn(
      '[image-placeholder] upload.updateFileInfo not found; description will only be writable via direct queries.'
    );
    return;
  }

  // Guard against double-wrapping (e.g. hot reload in development).
  if (service.updateFileInfo.__imagePlaceholderWrapped) {
    return;
  }

  const original = service.updateFileInfo.bind(service);

  const wrapped = async function updateFileInfo(id, fileInfo, ...rest) {
    const result = await original(id, fileInfo, ...rest);

    if (fileInfo && Object.prototype.hasOwnProperty.call(fileInfo, fieldName)) {
      const value = fileInfo[fieldName];

      await strapi.db.query(FILE_UID).update({
        where: { id },
        data: { [fieldName]: value },
      });

      // Return the freshly written value merged in, so API responses are correct.
      return { ...result, [fieldName]: value };
    }

    return result;
  };

  wrapped.__imagePlaceholderWrapped = true;
  service.updateFileInfo = wrapped;

  strapi.log.info(
    `[image-placeholder] Patched upload.updateFileInfo to persist "${fieldName}".`
  );
}
