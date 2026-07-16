# Creator Card Porter (Chrome MV3)

This extension captures character-definition traffic from the creator's current
browser session and exports `creator-card-porter.character-form-source` JSON. The first
adapter supports JanitorAI/JannyAI.

## Local install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this `creator-card-porter/` directory.
4. Open a creator-owned JanitorAI character page or editor and let the fields load.
5. Open the extension from either `/characters/{id}` or `/edit_character/{id}` and
   choose **Capture current page**. If the character is not available in page props,
   the extension reloads the tab once so its network interceptor can collect the
   editor response. The result is added to the locally cached migration set instead
   of replacing previously captured data.
6. If the character links a Lorebook, open each `/scripts/{id}/edit` page and choose
   **Capture current page**. The extension directly reads `/hampter/script/{id}` in
   the signed-in tab and adds its Playbook entries to the cached character export.

A Scripts edit page can also be captured and exported on its own. Importing that JSON
into an existing the target platform form only appends its Playbook items because the character
fields are empty.

Until **Clear captures** is used, the popup composes its JSON from the latest cached
character plus every captured Lorebook. Capturing the same character or Script again
updates that source; capturing a different source supplements the set. Reloading the
web page is still useful for passive network capture, but is not required for the
manual Scripts-page action.

## Privacy boundary

- Captures only character endpoints under `/hampter/characters` or
  `/api/characters`, and lorebook endpoints under `/hampter/script/{id}` or
  `/api/script(s)`.
- Does not capture chats, generation requests, cookies, authorization headers,
  passwords, or API keys.
- Keeps at most twelve recent character/lorebook captures in `chrome.storage.local`.
- All mapping and JSON generation happen locally in the browser.
- When an unmapped source field exists, **Download capture diagnostics** can
  export the captured request/response body after an explicit confirmation.
  The diagnostic still contains no cookies or authorization headers, but it can
  contain the full private character definition and should only be shared intentionally.

## Current mapping

| JanitorAI | the target platform |
|---|---|
| `name` | `basicInfo.name` |
| `description` | `basicInfo.bio`; first paragraph derives `basicInfo.hook` |
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

the target platform attributes, creator notes, and visual prologue have no verified JanitorAI
equivalent and remain visible as missing fields in the preview. Script priority and
insertion-order fields have no direct the target platform equivalent. Exports are capped at the target platform's
30 Playbook items.

## Verify the adapter

```bash
npm test
```
