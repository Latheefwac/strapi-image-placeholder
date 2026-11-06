# Showing `description` in the Media Library edit dialog (optional)

The core plugin makes `description` a real schema field and editable via the
API. Strapi's Media Library **edit modal**, however, renders a hardcoded list of
inputs and provides **no injection zone**, so the only way to surface the field
*inside that modal* is to modify the Upload plugin's admin form.

The cleanest, upgrade-safe way to do that is [`patch-package`](https://www.npmjs.com/package/patch-package),
which records your change as a diff and re-applies it after every `npm install`.

> This step is **version-specific** because the admin internals differ between
> Strapi v4 and v5. Pick the matching section. You do **not** need this for the
> field to work in your frontend or API.

```bash
npm install --save-dev patch-package
# add to package.json scripts:  "postinstall": "patch-package"
```

---

## Strapi v5

Edit **both** the CommonJS and ESM builds so dev and production match:

- `node_modules/@strapi/upload/dist/admin/components/EditAssetDialog/EditAssetContent.js`
- `node_modules/@strapi/upload/dist/admin/components/EditAssetDialog/EditAssetContent.mjs`

**1. Allow the field through validation.** Find `fileInfoSchema`:

```js
const fileInfoSchema = yup.object({
    name: yup.string().required(),
    alternativeText: yup.string(),
    caption: yup.string(),
    description: yup.string(),   // <-- add
    folder: yup.number()
});
```

**2. Seed the initial value.** In `initialFormData`:

```js
const initialFormData = !folderStructureIsLoading && {
    name: asset?.name,
    alternativeText: asset?.alternativeText ?? undefined,
    caption: asset?.caption ?? undefined,
    description: asset?.description ?? undefined,   // <-- add
    parent: { /* ...unchanged... */ }
};
```

**3. Render an input.** Right after the `caption` `Field.Root` block, add
another field bound to Formik (using the same `jsxRuntime.jsx` factory the file
already uses):

```js
jsxRuntime.jsxs(designSystem.Field.Root, {
    name: "description",
    children: [
        jsxRuntime.jsx(designSystem.Field.Label, { children: "Description" }),
        jsxRuntime.jsx(designSystem.Textarea, {
            value: values.description,
            onChange: handleChange,
            disabled: formDisabled
        })
    ]
}),
```

`handleSubmit` already sends `{ ...asset, ...values }`, so `description` flows
into `updateFileInfo`, where this plugin's service patch persists it. No other
change is needed.

**4. Lock it in:**

```bash
npx patch-package @strapi/upload
```

This writes `patches/@strapi+upload+<version>.patch`, re-applied on every
install.

---

## Strapi v4

The equivalent form lives in the v4 Upload plugin admin source:

- `node_modules/@strapi/plugin-upload/admin/src/components/EditAssetDialog/index.js`

The edits are conceptually the same — add `description` to the form's yup schema,
to its initial values, and render a `Textarea`/`TextInput` bound to the form
state — but v4 uses `@strapi/design-system/v2` components and its own form
plumbing, so match the surrounding imports in that file. Then:

```bash
npx patch-package @strapi/plugin-upload
```

---

## Caveat

Patches are tied to the package version string. After a Strapi upgrade,
`patch-package` may report the patch no longer applies cleanly — re-do the small
edit against the new file and re-run `npx patch-package`. This is the trade-off
for placing the field inside a modal that Strapi does not make extensible.
