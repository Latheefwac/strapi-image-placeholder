'use strict';

module.exports = {
  // Plugin identifier (matches `strapi.name` in package.json and the key used
  // in the host app's plugins config).
  PLUGIN_ID: 'image-placeholder',

  // UID of the Media Library file model. Stable across Strapi v4 and v5.
  FILE_UID: 'plugin::upload.file',

  // Name of the Upload plugin and its main service. Stable across v4 and v5.
  UPLOAD_PLUGIN: 'upload',
  UPLOAD_SERVICE: 'upload',

  // Content Manager plugin + the services whose `findConfiguration` builds the
  // edit-view metadata (where per-field hint/description text comes from).
  // Same shape on Strapi v4 and v5.
  CONTENT_MANAGER_PLUGIN: 'content-manager',
  CONFIG_SERVICES: ['content-types', 'components'],
};
