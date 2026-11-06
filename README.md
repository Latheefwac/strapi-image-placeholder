# Strapi Plugin — Image Placeholder

Adds a custom, editable **`description`** field to the Strapi Media Library file
schema (`plugin::upload.file`).

- ✅ One codebase for **Strapi v4 _and_ v5**
- ✅ Works in **JavaScript and TypeScript** projects
- ✅ Set required image sizes from the **Content-Type Builder** (Advanced tab)
- ✅ Field name / type / required are configurable
- ✅ Value is exposed automatically through **REST and GraphQL**

> The bulk of the plugin is server-side (schema + hint injection). It adds one
> tiny, dependency-free **admin** module that registers a field in the
> Content-Type Builder — so installing/updating it does require an admin
> rebuild (`npm run build` / restart `develop`).

---

## How it works

The plugin does two things at `register` time:

1. **Schema extension** — it adds the configured attribute (default
   `description`, type `text`) to the Media Library file content-type. Because
   `register()` runs before Strapi builds its database models, Strapi creates a
   real column for it. From then on the field behaves like any other file
   attribute and is returned in REST/GraphQL responses.

2. **Service decoration** — Strapi's `upload.updateFileInfo` service only
   accepts `name`, `alternativeText`, `caption` and `folder` (it is identical on
   v4 and v5). The plugin wraps that method so the new field is **persisted**
   whenever it is included in the update payload — making it editable through
   the standard media update endpoint and any programmatic call.

> **Why server-only?** The Strapi admin panel changed significantly between v4
> and v5 (`@strapi/helper-plugin` was removed, the design-system was replaced).
> A single admin bundle cannot run on both. Keeping the plugin server-only is
> what allows **one unchanged codebase** to support every v4 and v5, JS and TS
> project. See [Showing the field in the Media Library UI](#optional-showing-the-field-in-the-media-library-ui)
> for an optional, version-specific UI snippet.

---

## Installation

### From npm

```bash
npm install strapi-image-placeholder
# or
yarn add strapi-image-placeholder
```

Strapi auto-discovers it (the package declares `strapi.name: "image-placeholder"`),
so once installed you enable/configure it under the key **`image-placeholder`** —
no `resolve` needed.

### As a local plugin (for development)

Copy this folder into your project (commonly `src/plugins/image-placeholder`)
and point to it via `resolve` (see the commented line in the config below).

---

## Enable & configure

Strapi auto-discovers packages named `strapi-plugin-*`. You can still enable it
explicitly and override defaults.

**JavaScript** — `config/plugins.js`:

```js
module.exports = ({ env }) => ({
  'image-placeholder': {
    enabled: true,
    // resolve: './src/plugins/image-placeholder', // only for a LOCAL plugin
    config: {
      fieldName: 'description', // attribute name added to media files
      fieldType: 'text',        // 'text' | 'string' | 'richtext'
      required: false,          // see the warning below before enabling
    },
  },
});
```

**TypeScript** — `config/plugins.ts`:

```ts
export default ({ env }) => ({
  'image-placeholder': {
    enabled: true,
    config: {
      fieldName: 'description',
      fieldType: 'text',
      required: false,
    },
  },
});
```

After enabling, restart Strapi. On boot you should see:

```
[image-placeholder] Added "description" (text) to plugin::upload.file.
[image-placeholder] Patched upload.updateFileInfo to persist "description".
```

### Config options

| Option      | Type                              | Default         | Description |
| ----------- | --------------------------------- | --------------- | ----------- |
| `fieldName` | `string`                          | `"description"` | Attribute name added to the file model. Cannot be a native file attribute (`name`, `alternativeText`, `caption`, `url`, `hash`, `ext`, `mime`, `size`). |
| `fieldType` | `"text" \| "string" \| "richtext"`| `"text"`        | Underlying scalar type. |
| `required`  | `boolean`                         | `false`         | If `true`, the column is `NOT NULL`. **⚠️ Warning:** the upload flow does not send a description on creation, so a required field will block every new upload. Only enable if you populate the field on upload yourself. |

---

## Reading the value

Once installed, the field comes back with the asset everywhere media is
returned.

**REST** (a content entry that populates an image):

```jsonc
{
  "data": {
    "id": 1,
    "attributes": {
      "cover": {
        "data": {
          "attributes": {
            "url": "/uploads/photo.png",
            "alternativeText": "A cat",
            "description": "Low-quality blur placeholder / long-form description"
          }
        }
      }
    }
  }
}
```

**GraphQL**:

```graphql
query {
  uploadFiles {
    data {
      attributes {
        url
        description
      }
    }
  }
}
```

---

## Writing the value (API)

Because the field is whitelisted into `updateFileInfo`, you can update it
through the normal media update endpoint by including it in `fileInfo`.

```bash
# Strapi v4 & v5 — admin or content API upload update
curl -X POST "http://localhost:1337/api/upload?id=42" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -F 'fileInfo={"description":"My image description"}'
```

Programmatically (e.g. in a lifecycle or service):

```js
await strapi.plugin('upload').service('upload').updateFileInfo(42, {
  description: 'Set from code',
});
```

---

## Required image size hint on media fields

Declare a recommended/required size on any **media field** in a content-type
schema, and the plugin shows it as hint text under that field in the Content
Manager edit view — no admin code, works on v4 and v5.

```jsonc
// src/api/<name>/content-types/<name>/schema.json
"image": {
  "type": "media",
  "multiple": false,
  "allowedTypes": ["images"],
  "pluginOptions": {
    "image-placeholder": { "requiredSize": "1200x630" }
  }
}
```

Result under the field: **“Recommended size: 1200×630px”**.

### Setting it from the Content-Type Builder (no schema editing)

You don't have to hand-edit `schema.json`. When you add or edit a **media
field** in the Content-Type Builder, open the **Advanced settings** tab — the
plugin adds a **“Required image size”** input there. Type e.g. `1200x630` and
save; the plugin writes it into `pluginOptions` for you, and the hint then shows
under the field in the content editor.

> This input is contributed via the Content-Type Builder forms API. After
> installing or updating the plugin, rebuild the admin (`npm run build`, or just
> restart `npm run develop`) so the new field appears.

- Works for media fields on the content-type **and for media fields nested
  inside components / dynamic zones** — put the `pluginOptions` on the media
  field in the *component's* `schema.json` for those.
- The value can be `"WxH"` (e.g. `"1200x630"`) or any free-form string
  (e.g. `"min 800px wide"`).
- A description you set manually via **Configure the view** always takes
  precedence — the plugin only fills an empty description.
- Customize the wording with `sizeHintTemplate` (placeholders `{size}`,
  `{width}`, `{height}`) or turn the feature off with
  `showRequiredSizeHint: false` in the plugin config.

> **How it works:** the plugin wraps the content-manager `findConfiguration`
> service to fill `metadatas.<field>.edit.description` from the field's
> `pluginOptions`. The Upload plugin's media input already renders that
> description as a hint, so nothing on the admin side needs to change.
>
> After changing a schema or the plugin config, **restart Strapi** and refresh
> the admin (the edit-view layout is fetched live, so no admin rebuild needed).

### Config options for the hint

| Option                 | Type      | Default                         | Description |
| ---------------------- | --------- | ------------------------------- | ----------- |
| `showRequiredSizeHint` | `boolean` | `true`                          | Enable/disable the hint injection. |
| `sizeHintTemplate`     | `string`  | `"Recommended size: {size}px"`  | Hint text. `{size}` → `1200×630`, `{width}` → `1200`, `{height}` → `630`. |

---

## (Optional) Showing the field in the Media Library UI

Strapi's Media Library edit dialog renders a **fixed** set of inputs (file name,
alternative text, caption, location) and exposes **no injection zone**, so a
plugin cannot add a field to it through a supported API. If you want the
`description` editable inside the modal, override the Upload plugin's edit form
in your app with a small extension. This part is **version-specific** (the admin
internals differ between v4 and v5).

See [`docs/media-library-ui.md`](docs/media-library-ui.md) for copy-paste
snippets for both v4 and v5. The core plugin works without this step — the field
is already editable via the API and visible in your frontend.

---

## Compatibility

| Strapi | Status |
| ------ | ------ |
| v5.x   | ✅ Tested against 5.25 |
| v4.x   | ✅ Tested against 4.25 |

Uses only stable server APIs (`strapi.contentTypes`, `strapi.plugin().service()`,
the `register` lifecycle, `strapi.db.query`) that are identical across v4 and v5.

---

## Development

```bash
npm test   # dependency-free smoke test of the register logic
```

## License

MIT
# Image-Placeholder
