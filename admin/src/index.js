/**
 * Admin entry for the Image Placeholder plugin.
 *
 * Adds a "Required image size" input to the **Advanced settings** tab of the
 * Content-Type Builder for media fields. The value is stored at
 *   pluginOptions['image-placeholder'].requiredSize
 * which the server side reads to render the hint under the field in the editor.
 *
 * Uses only the Content-Type Builder forms API (no JSX, no design-system, no
 * other imports), so the exact same code runs on Strapi v4 and v5. The built
 * files in `dist/admin` are hand-authored copies of this module (no build
 * toolchain) — keep them in sync with this file.
 */
const PLUGIN_ID = 'image-placeholder';

const requiredSizeField = {
  // Persisted into the schema's pluginOptions, read by the server.
  name: `pluginOptions.${PLUGIN_ID}.requiredSize`,
  type: 'text',
  intlLabel: {
    id: `${PLUGIN_ID}.ctb.requiredSize.label`,
    defaultMessage: 'Required image size',
  },
  description: {
    id: `${PLUGIN_ID}.ctb.requiredSize.description`,
    defaultMessage:
      'Recommended dimensions for this field, e.g. "1200x630". Shown as a hint under the field in the content editor.',
  },
};

function extendMediaAdvancedForm(app) {
  const ctbPlugin = app.getPlugin('content-type-builder');
  if (!ctbPlugin) {
    return;
  }

  const formsAPI = ctbPlugin.apis && ctbPlugin.apis.forms;
  if (!formsAPI || typeof formsAPI.extendFields !== 'function') {
    return;
  }

  formsAPI.extendFields(['media'], {
    form: {
      advanced() {
        return [requiredSizeField];
      },
    },
  });
}

const adminPlugin = {
  register(app) {
    extendMediaAdvancedForm(app);
  },
  bootstrap() {},
};

export default adminPlugin;
