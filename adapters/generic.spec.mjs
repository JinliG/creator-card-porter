import assert from "node:assert/strict";

import "./generic.js";

const documentValue = globalThis.CreatorCardGenericAdapter.buildDocument({
  platform: "other",
  kind: "editor-form",
  resourceType: "character",
  resourceId: "page-abc123",
  capturedAt: "2026-07-17T03:00:00.000Z",
  responseBody: {
    character: {
      name: "Generic Character",
      description: "<p>A public description.</p>",
      personality: "A careful, adaptable persona.",
      scenario: "A shared workshop.",
      firstMessage: "Welcome, {{user}}.",
      exampleDialogs: "{{char}}: Example",
      avatar: "https://images.example/character.webp",
      tags: "Original, Sci-Fi",
      platformOnlyOption: "preserve me",
      _capturedFormFields: [{ name: "character_name", value: "Generic Character" }],
    },
  },
});

assert.equal(documentValue.version, 2);
assert.equal(documentValue.source.platform, "other");
assert.equal(
  documentValue.source.character.data.platformOnlyOption,
  "preserve me",
  "generic source fields must remain lossless",
);
assert.equal(documentValue.form.basicInfo.name, "Generic Character");
assert.deepEqual(documentValue.form.basicInfo.tag, ["Original", "Sci-Fi"]);
assert.ok(
  documentValue.form.characterSettings.persona.includes("<example_dialogs>"),
);
assert.equal(documentValue.form.characterSettings.memorySeed, "A shared workshop.");
assert.equal(documentValue.form.playbook.length, 0);
assert.ok(
  documentValue.unmapped.some(
    (entry) =>
      entry.sourceField === "source.character.data.platformOnlyOption",
  ),
  "unknown generic fields should be inventoried",
);

console.log("Generic adapter checks passed.");
