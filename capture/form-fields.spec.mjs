import assert from "node:assert/strict";

import "./form-fields.js";

const helper = globalThis.CreatorCardFormCapture;

const fields = [
  {
    name: "character_name",
    id: "character-name",
    label: "Character Name",
    type: "text",
    value: "乾巧",
  },
  {
    name: "personality",
    label: "Personality",
    type: "textarea",
    value: "A complete creator definition.",
  },
  {
    label: "Character Bio",
    type: "textarea",
    value: "Public description.",
  },
  {
    id: "initial-message",
    label: "Initial Message",
    type: "textarea",
    value: "Hello {{user}}",
  },
  {
    name: "experimental_setting",
    label: "Experimental setting",
    type: "text",
    value: "strict",
  },
];

const character = helper.buildCharacterFromFields(fields);

assert.equal(character.name, "乾巧");
assert.equal(character.personality, "A complete creator definition.");
assert.equal(character.description, "Public description.");
assert.equal(character.firstMessage, "Hello {{user}}");
assert.equal(character.experimental_setting, "strict");
assert.deepEqual(
  character._capturedFormFields,
  fields,
  "all selected editor fields should remain available in source data",
);
assert.ok(
  helper.characterScore(character) >= 4,
  "a populated editor form should qualify as a character source",
);
assert.equal(
  helper.canonicalField({
    name: "search",
    placeholder: "Search for characters or creators",
    value: "乾巧",
  }),
  "",
  "the site search box must not become the character name",
);
assert.equal(
  helper.canonicalField({ label: "角色设定", value: "冷静、谨慎" }),
  "personality",
  "localized common labels should map to the standard character fields",
);
assert.equal(
  helper.canonicalField({ name: "ch_name", value: "Generic Character" }),
  "name",
  "common character-card field names should be recognized",
);

console.log("Character editor form fallback checks passed.");
