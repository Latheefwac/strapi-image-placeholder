'use strict';

const { PLUGIN_ID } = require('./constants');

const DEFAULTS = {
  fieldName: 'description',
  fieldType: 'text',
  required: false,
  showRequiredSizeHint: true,
  sizeHintTemplate: 'Recommended size: {size}px',
};

/**
 * Reads the plugin configuration in a way that works on both Strapi v4 and v5.
 *
 * The config namespace differs between major versions:
 *   - Strapi v5 stores plugin config under `plugin::<id>`
 *   - Strapi v4 stores plugin config under `plugin.<id>`
 *
 * We read both, then fall back to hard defaults so the plugin is always usable
 * even if the host app provides no config block at all.
 */
function getConfig(strapi) {
  let userConfig = {};

  try {
    userConfig =
      strapi.config.get(`plugin::${PLUGIN_ID}`) ||
      strapi.config.get(`plugin.${PLUGIN_ID}`) ||
      {};
  } catch (err) {
    userConfig = {};
  }

  // Some Strapi setups nest user values under a `config` key, others put them
  // at the top level. Support both shapes.
  const merged = {
    ...DEFAULTS,
    ...userConfig,
    ...(userConfig && typeof userConfig.config === 'object' ? userConfig.config : {}),
  };

  return {
    fieldName: typeof merged.fieldName === 'string' && merged.fieldName.trim()
      ? merged.fieldName.trim()
      : DEFAULTS.fieldName,
    fieldType: ['string', 'text', 'richtext'].includes(merged.fieldType)
      ? merged.fieldType
      : DEFAULTS.fieldType,
    required: merged.required === true,
    showRequiredSizeHint: merged.showRequiredSizeHint !== false,
    sizeHintTemplate:
      typeof merged.sizeHintTemplate === 'string' && merged.sizeHintTemplate.trim()
        ? merged.sizeHintTemplate
        : DEFAULTS.sizeHintTemplate,
  };
}

module.exports = { getConfig, DEFAULTS };
