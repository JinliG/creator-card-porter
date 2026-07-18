import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("./manifest.json", import.meta.url)));
const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url)));
const popup = readFileSync(new URL("./popup/popup.html", import.meta.url), "utf8");
const popupScript = readFileSync(new URL("./popup/popup.js", import.meta.url), "utf8");
const capture = readFileSync(new URL("./capture/content.js", import.meta.url), "utf8");
const genericCapture = readFileSync(new URL("./capture/generic-content.js", import.meta.url), "utf8");
const janitorPageState = readFileSync(
  new URL("./capture/janitor-page-state.js", import.meta.url),
  "utf8",
);

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, packageJson.version, "manifest and package versions must match");
assert.deepEqual(
  [...manifest.permissions].sort(),
  ["activeTab", "scripting", "storage"].sort(),
  "only user-triggered capture and local storage permissions should be requested",
);
assert.equal("host_permissions" in manifest, false, "persistent host access must stay disabled");
assert.equal("content_scripts" in manifest, false, "capture must not run automatically on page load");
assert.equal("background" in manifest, false, "the extension should have no always-on worker");
assert.equal(
  existsSync(new URL("./capture/page-bridge.js", import.meta.url)),
  false,
  "the removed network interceptor must not return",
);
assert.equal(capture.includes("window.fetch ="), false, "capture must not replace page fetch");
assert.equal(
  capture.includes("XMLHttpRequest.prototype"),
  false,
  "capture must not replace page XMLHttpRequest",
);
assert.equal(
  `${capture}\n${popupScript}`.includes("chrome.storage.local.clear"),
  false,
  "stored sources must only be removed by the explicit Clear captures action",
);
assert.match(
  popupScript,
  /capture\/form-fields\.js.*capture\/content\.js/s,
  "the editor-form fallback must load before capture",
);
assert.match(
  popupScript,
  /world: "MAIN".*capture\/janitor-page-state\.js/s,
  "Janitor creator state must be read from the already hydrated editor after an explicit capture",
);
assert.match(
  popupScript,
  /CREATOR_CARD_PERSIST_PAGE_STATE/,
  "hydrated Janitor editor state must cross a validated extension message boundary",
);
assert.match(
  popupScript,
  /capture\/form-fields\.js.*capture\/generic-content\.js/s,
  "Other must inject only the generic form capture after explicit selection",
);
assert.match(popup, /Manual capture only\./);
assert.match(popup, /value="other">Other \(experimental\)/);
assert.match(popup, /Experimental capture/);
assert.match(popup, /adapters\/generic\.js/);
assert.match(popup, /data-tab="preview"/);
assert.match(popup, /data-tab="mapping"/);
assert.match(popup, /data-tab="json"/);
assert.match(popup, /Standard character information template/);
assert.match(popup, /Privacy &amp; data use/);
assert.equal(
  genericCapture.includes("fetch("),
  false,
  "Other must not probe unknown platform endpoints",
);
assert.equal(
  janitorPageState.includes("fetch("),
  false,
  "hydrated Janitor state capture must not replay authenticated endpoints",
);
assert.equal(
  janitorPageState.includes("access_token"),
  false,
  "hydrated Janitor state capture must not inspect authorization tokens",
);
assert.match(
  janitorPageState,
  /\[Creator Card Porter\]/,
  "Janitor page-state diagnostics must use a stable page-console prefix",
);
assert.match(
  popupScript,
  /world: "MAIN"[\s\S]*\[Creator Card Porter\]/,
  "capture result diagnostics must be written to the website console",
);
assert.equal(
  `${janitorPageState}\n${capture}\n${popupScript}`.includes("console.info(responseBody"),
  false,
  "diagnostics must not print captured response bodies",
);
assert.equal(
  capture.includes("/hampter/script/${"),
  false,
  "manual capture must not replay the creator-only Scripts endpoint",
);
assert.equal(
  capture.includes("fetch("),
  false,
  "manual capture must not replay creator-only Janitor endpoints",
);

console.log("Manifest privacy checks passed.");
