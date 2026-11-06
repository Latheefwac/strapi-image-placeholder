'use strict';

const register = require('./register');
const config = require('./config');
const decorateContentManager = require('./decorate-content-manager');
const { getConfig } = require('./utils/get-config');

/**
 * Plugin server interface.
 *
 * - register(): extends the Media Library file schema with the custom field and
 *   makes it persist through the upload update endpoint.
 * - bootstrap(): decorates the Content Manager so media fields can show their
 *   declared required size as hint text (runs here because the content-manager
 *   services are guaranteed to be available after all plugins have loaded).
 *
 * Only stable server APIs are used, so a single codebase runs on Strapi v4 & v5.
 */
module.exports = {
  register,
  config,
  bootstrap({ strapi }) {
    const { showRequiredSizeHint, sizeHintTemplate } = getConfig(strapi);
    decorateContentManager(strapi, { showRequiredSizeHint, sizeHintTemplate });
  },
  destroy() {},
};
