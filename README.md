# Creator Card Porter (Chrome MV3)

Creator Card Porter captures character-definition data from a creator's current
browser session and exports a portable, versioned form-source JSON document. The
JanitorAI/JannyAI adapter captures its verified character and Scripts structures.
An experimental **Other** adapter can recognize common fields from many native
character-editor forms.

Creator Card Porter is an independent open-source utility maintained through
community contributions. References to supported services are descriptive
compatibility labels only; names and marks remain with their respective owners.

For installation, JanitorAI workflow, and limitations, see the
[English user guide](./user-guide/README.md) or
[Chinese user guide](./user-guide/README.zh-CN.md).

For data handling details, see [the privacy policy](./PRIVACY.md). For store
submission copy and permission explanations, see
[the Chrome Web Store checklist](./CHROME_WEB_STORE.zh-CN.md).

## Local install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this extension directory.
4. Leave **Source platform** set to **JanitorAI**.
5. Open a creator-owned JanitorAI character page or editor and let its fields load.
6. Open the extension from either `/characters/{id}` or `/edit_character/{id}` and
   choose **Capture current page**.
7. If the character uses a Lorebook, open each `/scripts/{id}/edit` page and choose
   **Capture current page**. The extension reads the character or Scripts data
   already loaded into that signed-in editor and adds its Playbook entries to the
   cached export.

Until **Clear captures** is used, the popup composes its JSON from the latest cached
character plus every captured Lorebook. Capturing the same character or Script again
updates that source; capturing a different source supplements the set. A Scripts page
can also be exported on its own.

### Other platforms (experimental)

1. Choose **Other (experimental)** under **Source platform**.
2. Open a character editor and wait until its fields are visible. Expand any
   collapsed sections that should be included.
3. Choose **Capture current page** and review **Preview**, **Mapping**, and **JSON**
   before importing the file.

Other recognizes common native form fields such as name, description, personality,
scenario, greeting, example dialogs, avatar, and tags. It is a best-effort form
reader, not a verified integration: custom rich-text editors, canvas-based editors,
iframes, renamed fields, and dynamically hidden sections can be missed or mapped
incorrectly. It does not discover separate Lorebooks or probe undocumented APIs.

The popup separates the result into three views: **Preview** shows the captured
source character and Scripts information, **Mapping** explains how source fields
feed the standard character information template, and **JSON** shows the complete
export document.

## Privacy boundary

- Does not read a source page until the user clicks **Capture current page**.
- Uses temporary `activeTab` access for the selected tab; it declares no persistent
  host access and installs no always-on content script or background worker.
- On a character or Scripts edit page, it first reads the complete source state
  already hydrated into the current editor by JanitorAI. This avoids copying login
  tokens or replaying creator-only requests. If no hydrated character state is
  available, it reads serialized page data and then falls back to current character
  editor form controls.
- In **Other** mode, it reads only recognizable native form controls on the current
  selected page after the capture click. It does not guess or probe that site's API
  endpoints.
- Does not intercept general page traffic or modify `fetch`/`XMLHttpRequest`.
- Does not capture chats, generation requests, cookies, authorization headers,
  passwords, or API keys.
- Keeps captured character/Lorebook sources in `chrome.storage.local` until the
  user chooses **Clear captures** or uninstalls the extension. If the browser's
  local extension-storage capacity is exhausted, the capture fails visibly
  instead of silently discarding or truncating source fields.
- Checks the current page URL only to verify support and identify the selected
  character or Scripts editor. It does not retain that URL or browsing history.
- All mapping and JSON generation happen locally in the browser. The extension
  has no developer-operated upload or analytics service.
- **Download capture diagnostics** exports captured request/response bodies only
  after explicit confirmation. The file still contains no cookies or authorization
  headers, but it can contain a full private character definition and should only be
  shared intentionally.

## Current mapping

### JanitorAI

| JanitorAI | Target form |
|---|---|
| `name` | `basicInfo.name` |
| `description` | `basicInfo.bio`; opening text derives `basicInfo.hook` |
| `avatar` / `imageUrl` | `basicInfo.imageUrl` and initial `avatarUrl` |
| `tags` / `tagIds` | `basicInfo.tag` |
| `personality` | `characterSettings.persona` |
| `exampleDialogs` | appended to Persona as `<example_dialogs>` |
| `scenario` | `characterSettings.memorySeed` |
| `firstMessage` | `characterSettings.greeting` |
| Lorebook `script` JSON entries | `playbook[]` |
| entry `name` / `content` / `enabled` | Playbook name / body / enabled |
| entry keywords | natural-language Playbook trigger condition |
| entry `constant: true` | Always On · Reminder |

Attributes, creator notes, and visual prologue have no verified JanitorAI equivalent
and remain visible as missing fields in the preview. Script priority and insertion
order have no direct target equivalent. Exports are capped at 30 Playbook items.

### Other (experimental)

| Common source field | Target form |
|---|---|
| name / character name | `basicInfo.name` |
| description / bio | `basicInfo.bio`; opening text derives `basicInfo.hook` |
| avatar / image | `basicInfo.imageUrl` and initial `avatarUrl` |
| tags | `basicInfo.tag` |
| personality / persona / definition | `characterSettings.persona` |
| example dialogs | appended to Persona as `<example_dialogs>` |
| scenario / context | `characterSettings.memorySeed` |
| first message / greeting | `characterSettings.greeting` |

Unrecognized source fields remain in `source.character.data` and are listed in
`unmapped`; they are not silently discarded.

## JSON contract

Exports use `creator-card-porter.character-form-source` version `2` and deliberately separate
the captured source from the mapped form:

- `source.character.data` preserves the complete character record read from the
  creator page, including fields that have no target mapping.
- `source.scripts[].data` preserves the complete record for every separately
  captured Scripts page. Re-capturing the same Script replaces its cached source;
  capturing another Script supplements the set.
- `form` contains only the values mapped into the target character form, including
  up to 30 mapped Playbook items. Source fields are never removed just because the
  target form has no equivalent.
- `mapping` records the exact `source.*` paths used for each target field, while
  `unmapped` inventories captured fields or entries that could not be mapped.

Version `1` exports are not supported by the current importer.

## Capture logs

Open the creator page's DevTools Console and filter for
`[Creator Card Porter]` to inspect the manual capture lifecycle. Logs identify
the page type, resource ID, capture strategy, field or entry counts, cache write,
and failure stage. They never print captured field values, response bodies,
cookies, authorization tokens, or request headers.

## Verify the adapter

```bash
npm test
```

## Free software and responsibility

Creator Card Porter is free, open-source software maintained through community
contributions and provided on an “as is” basis, without a guarantee of continuous
availability, compatibility, or error-free results.

Users are responsible for confirming that they have permission to handle the
content they capture, for complying with the rules of each service they use, and
for reviewing and backing up data before importing, publishing, or sharing it. To
the extent permitted by applicable law, the maintainers and contributors are not
responsible for consequences arising from misuse, service-policy changes, account
restrictions, data loss, compatibility problems, or third-party disputes.

## License

[MIT](./LICENSE)
