/**
 * Built (ESM) admin entry — hand-authored copy of ../../admin/src/index.js.
 * Keep in sync with the source. No build step is required because the code has
 * no JSX and no external imports.
 */
const PLUGIN_ID = 'image-placeholder';

const requiredSizeField = {
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

export { adminPlugin as default };
