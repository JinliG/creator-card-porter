# Creator Card Porter Privacy Policy

Last updated: July 17, 2026

Creator Card Porter is an independent open-source utility maintained through
community contributions. References to supported services are descriptive
compatibility labels only; names and marks remain with their respective owners.

## What the extension handles

The extension handles data only after the user clicks **Capture current page**
on the selected creator page. Depending on that page, the data can include:

- character or Lorebook text and settings;
- image URLs;
- source resource identifiers and capture timestamps.

This includes complete creator-form records, including source fields that do not
have a target form mapping.

The current page URL is checked only to verify that the page is supported and
identify the selected character or Scripts editor. It is not retained as browsing
history. The extension does not collect chats, passwords, cookies, authorization
headers, or API keys.

In experimental **Other** mode, the extension reads recognizable native form
controls on the selected page only after the capture click. It does not guess or
probe API endpoints on an unknown site.

On JanitorAI creator edit pages, the extension reads source data already loaded
into the editor. It does not read, copy, or export the page's authorization token.

For troubleshooting, the extension writes capture lifecycle metadata to the
selected page's DevTools Console with the prefix `[Creator Card Porter]`. These
logs can include the source type, resource identifier, capture strategy, counts,
and failure stage. They do not include captured field values, full response
bodies, cookies, authorization tokens, or request headers.

## Why the data is handled

The data is used only to preview field mappings and create the JSON file requested
by the user. This is the extension's single purpose.

## Storage, transmission, and retention

- Captured data and mappings are processed locally in the user's browser.
- Captures are stored in `chrome.storage.local` without field truncation. If the
  browser cannot store the complete capture, the extension reports an error and
  does not claim that capture succeeded.
- The extension has no developer-operated server, analytics service, advertising
  service, or automatic data-sharing function.
- Data remains until the user chooses **Clear captures** or uninstalls the
  extension.
- JSON and diagnostic files leave the browser only when the user explicitly
  downloads, copies, or shares them.

A diagnostic file can contain the full captured character or Lorebook definition.
The extension displays a confirmation before creating it.

## Permissions

- `activeTab`: temporarily identifies the tab selected by the user.
- `scripting`: runs the capture helper in that tab only after the user clicks the
  capture button.
- `storage`: keeps selected character and Lorebook sources locally so they can be
  combined before export.

The extension requests no persistent website access and runs no always-on content
script or background worker.

## Contact and changes

Privacy questions can be sent through the support contact on the Chrome Web Store
listing or raised in the public source repository. Material changes to data
handling will be reflected in this policy and in the extension's user-facing
disclosure before they take effect.
