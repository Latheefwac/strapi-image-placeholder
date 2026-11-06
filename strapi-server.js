'use strict';

/**
 * Server entry point for the Image Placeholder plugin.
 *
 * This is a server-only plugin (no admin bundle). That is a deliberate choice:
 * it lets a single, unchanged codebase run on both Strapi v4 and v5 (and on
 * JavaScript or TypeScript apps), because the admin panel APIs differ between
 * the two major versions while the server APIs used here do not.
 */
module.exports = require('./server');
