import "./janitorai.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function testBuildDocumentMapsJanitorFields() {
  const documentValue = globalThis.CreatorCardPorterJanitorAdapter.buildDocument({
    platform: "janitorai",
    kind: "network",
    url: "https://janitorai.com/hampter/characters/char-1",
    method: "PATCH",
    sourcePageUrl: "https://janitorai.com/characters/char-1_character-test",
    capturedAt: "2026-07-16T10:00:00.000Z",
    responseBody: {
      data: {
        id: "char-1",
        name: "Test Character",
        description:
          '<p><strong>A public description.</strong></p><p>More details.</p>',
        personality: "Core personality",
        scenario: "Shared history",
        firstMessage: "Hello {{user}}",
        exampleDialogs: "{{char}}: Example",
        avatar: "test.webp",
        tagIds: [9, 50],
        scripts: [{ id: "script-1" }],
      },
    },
  });

  assertEqual(documentValue.schema, "creator-card-porter.character-form-source", "schema name");
  assertEqual(documentValue.version, 1, "schema version");
  assertEqual(documentValue.form.basicInfo.name, "Test Character", "name mapping");
  assertEqual(
    documentValue.form.basicInfo.hook,
    "A public description. More details.",
    "hook should strip HTML without breaking tags",
  );
  assertEqual(
    documentValue.form.basicInfo.imageUrl,
    "https://image.jannyai.com/bot-avatars/test.webp",
    "relative avatar should resolve against the JanitorAI CDN",
  );
  assertEqual(documentValue.form.basicInfo.tag.join(","), "Anime,Romance", "tag mapping");
  assertEqual(documentValue.form.characterSettings.memorySeed, "Shared history", "scenario mapping");
  assert(
    documentValue.form.characterSettings.persona.includes("<example_dialogs>"),
    "example dialogs should be appended to persona",
  );
  assertEqual(documentValue.unmapped[0]?.sourceField, "scripts", "scripts remain explicit");
}

function testRequestBodyWinsWhenSaveResponseIsSparse() {
  const documentValue = globalThis.CreatorCardPorterJanitorAdapter.buildDocument({
    platform: "janitorai",
    kind: "network",
    url: "https://janitorai.com/hampter/characters/char-2",
    method: "PATCH",
    requestBody: {
      name: "Creator Draft",
      personality: "Latest creator definition",
      first_message: "Latest greeting",
    },
    responseBody: { id: "char-2", name: "Creator Draft" },
  });

  assertEqual(
    documentValue.form.characterSettings.persona,
    "Latest creator definition",
    "creator request should supply full definition",
  );
  assertEqual(
    documentValue.form.characterSettings.greeting,
    "Latest greeting",
    "snake_case aliases should map",
  );
}

function createLorebookCapture() {
  return {
    platform: "janitorai",
    resourceType: "script",
    kind: "network",
    url: "https://janitorai.com/hampter/script/script-1",
    method: "GET",
    sourcePageUrl: "https://janitorai.com/scripts/script-1/edit",
    capturedAt: "2026-07-16T11:00:00.000Z",
    responseBody: {
      id: "script-1",
      type: "lorebook",
      title: "Test lorebook",
      script: JSON.stringify([
        {
          id: 10,
          name: "Smart entry",
          key: ["garage", "engine"],
          content: "The garage contains prototype vehicles.",
          enabled: true,
          constant: false,
        },
        {
          id: 11,
          name: "Always known",
          key: [],
          content: "The city is under constant surveillance.",
          enabled: false,
          constant: true,
        },
      ]),
    },
  };
}

function testSeparateLorebookCaptureMapsToPlaybook() {
  const documentValue = globalThis.CreatorCardPorterJanitorAdapter.buildDocument(
    {
      platform: "janitorai",
      kind: "network",
      url: "https://janitorai.com/hampter/characters/char-3",
      method: "GET",
      responseBody: {
        id: "char-3",
        name: "Lorebook owner",
        personality: "Definition",
        scripts: [{ id: "script-1", type: "lorebook" }],
      },
    },
    [createLorebookCapture()],
  );

  assertEqual(documentValue.form.playbook.length, 2, "playbook entry count");
  assertEqual(
    documentValue.form.playbook[0].triggerType,
    "nl_trigger",
    "keyword entry should become a triggered Playbook item",
  );
  assert(
    documentValue.form.playbook[0].triggerCondition.includes("garage"),
    "keywords should be preserved in the trigger condition",
  );
  assertEqual(
    documentValue.form.playbook[1].triggerType,
    "reminder",
    "constant entry should become an Always On reminder",
  );
  assertEqual(
    documentValue.form.playbook[1].enabled,
    false,
    "disabled state should be preserved",
  );
  assertEqual(documentValue.unmapped.length, 0, "matched script should be mapped");
  assertEqual(
    documentValue.mapping.at(-1)?.targetField,
    "playbook",
    "preview should include the Playbook mapping",
  );
}

function testLorebookCanExportWithoutCharacterCapture() {
  const documentValue = globalThis.CreatorCardPorterJanitorAdapter.buildDocument(null, [
    createLorebookCapture(),
  ]);

  assertEqual(documentValue.source.characterId, null, "standalone character id");
  assertEqual(documentValue.form.basicInfo.name, "", "standalone name remains empty");
  assertEqual(documentValue.form.playbook.length, 2, "standalone playbook entries");
  assert(
    documentValue.source.captureKind.startsWith("script-"),
    "standalone export should identify its script capture",
  );
}

function testCapturedLorebookSupplementsCachedCharacter() {
  const documentValue = globalThis.CreatorCardPorterJanitorAdapter.buildDocument(
    {
      platform: "janitorai",
      kind: "network",
      url: "https://janitorai.com/hampter/characters/char-4",
      method: "GET",
      responseBody: {
        id: "char-4",
        name: "Cached character",
        personality: "Keep this definition",
      },
    },
    [createLorebookCapture()],
  );

  assertEqual(
    documentValue.form.basicInfo.name,
    "Cached character",
    "capturing a lorebook should preserve the cached character",
  );
  assertEqual(
    documentValue.form.playbook.length,
    2,
    "an independently captured lorebook should supplement the cached document",
  );
}

function testRecapturingScriptUpdatesInsteadOfDuplicating() {
  const newest = createLorebookCapture();
  newest.responseBody.script = JSON.stringify([
    {
      id: 10,
      name: "Updated entry",
      key: ["updated"],
      content: "Use the newest cached script body.",
      enabled: true,
      constant: false,
    },
  ]);

  const documentValue = globalThis.CreatorCardPorterJanitorAdapter.buildDocument(null, [
    newest,
    createLorebookCapture(),
  ]);

  assertEqual(
    documentValue.form.playbook.length,
    1,
    "the newest capture of the same script should replace its older entries",
  );
  assertEqual(
    documentValue.form.playbook[0].name,
    "Updated entry",
    "the newest script capture should win",
  );
}

testBuildDocumentMapsJanitorFields();
testRequestBodyWinsWhenSaveResponseIsSparse();
testSeparateLorebookCaptureMapsToPlaybook();
testLorebookCanExportWithoutCharacterCapture();
testCapturedLorebookSupplementsCachedCharacter();
testRecapturingScriptUpdatesInsteadOfDuplicating();
