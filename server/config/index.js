'use strict';

/**
 * Default plugin configuration.
 *
 * Override any of these from the consuming app's `config/plugins.js`
 * (or `config/plugins.ts`):
 *
 *   module.exports = {
 *     'image-placeholder': {
 *       enabled: true,
 *       config: {
 *         fieldName: 'description',
 *         fieldType: 'text',   // 'text' | 'string' | 'richtext'
 *         required: false,
 *       },
 *     },
 *   };
 */
module.exports = {
  default: {
    // Name of the attribute added to the media file model.
    fieldName: 'description',
    // Underlying scalar type for the field.
    fieldType: 'text',
    // If true the column is created NOT NULL. See the README warning before
    // enabling this — every upload would then need a description or it fails.
    required: false,

    // --- Required-size hint for media fields -------------------------------
    // When true, any media field whose schema declares
    //   pluginOptions: { 'image-placeholder': { requiredSize: '1200x630' } }
    // gets that size shown as hint text under the field in the Content Manager
    // edit view (only when the field has no manually configured description).
    showRequiredSizeHint: true,

    // Template for the hint. Placeholders: {size} -> "1200×630",
    // {width} -> "1200", {height} -> "630".
    sizeHintTemplate: 'Recommended size: {size}px',
  },

  validator(config) {
    if (config.fieldName !== undefined && typeof config.fieldName !== 'string') {
      throw new Error('[image-placeholder] config.fieldName must be a string');
    }
    if (config.fieldName !== undefined && config.fieldName.trim() === '') {
      throw new Error('[image-placeholder] config.fieldName must not be empty');
    }

    const allowedTypes = ['string', 'text', 'richtext'];
    if (config.fieldType !== undefined && !allowedTypes.includes(config.fieldType)) {
      throw new Error(
        `[image-placeholder] config.fieldType must be one of: ${allowedTypes.join(', ')}`
      );
    }

    if (config.required !== undefined && typeof config.required !== 'boolean') {
      throw new Error('[image-placeholder] config.required must be a boolean');
    }

    if (
      config.showRequiredSizeHint !== undefined &&
      typeof config.showRequiredSizeHint !== 'boolean'
    ) {
      throw new Error('[image-placeholder] config.showRequiredSizeHint must be a boolean');
    }

    if (config.sizeHintTemplate !== undefined && typeof config.sizeHintTemplate !== 'string') {
      throw new Error('[image-placeholder] config.sizeHintTemplate must be a string');
    }
  },
};
