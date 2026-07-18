import assert from "node:assert/strict";

import "./janitor-page-state.js";

const helper = globalThis.CreatorCardJanitorPageState;
const scriptId = "cc108343-ad6a-4f47-ae65-67a1b2622b48";
const entries = [
  {
    id: "entry-1",
    name: "First entry",
    key: ["keyword"],
    keysRaw: "keyword",
    content: "Complete lorebook content.",
    constant: false,
    enabled: true,
    placement: "scenario",
    placementPosition: "after",
    minMessages: 2,
    probability: 1,
  },
];

const scriptFiber = {
  memoizedProps: {
    scriptStore: {
      currentScript: {
        id: scriptId,
        title: "Lorebook",
        description: "Complete metadata",
        type: "lorebook",
        settings: '{"depth":4}',
        script: "[]",
      },
      currentCode: JSON.stringify(entries),
    },
  },
  memoizedState: null,
  child: null,
  sibling: null,
  return: null,
};
const rootElement = { __reactFiber$test: scriptFiber };
const documentValue = {
  documentElement: rootElement,
  body: null,
  querySelectorAll: () => [],
};

const originalConsoleInfo = console.info;
const logCalls = [];
console.info = (...args) => logCalls.push(args);

let result;
try {
  result = helper.captureCurrentSource(
    { resourceType: "script", resourceId: scriptId },
    documentValue,
  );
} finally {
  console.info = originalConsoleInfo;
}

assert.equal(result.captured, true);
assert.equal(result.responseBody.id, scriptId);
assert.equal(result.responseBody.title, "Lorebook");
assert.equal(result.responseBody.settings, '{"depth":4}');
assert.deepEqual(JSON.parse(result.responseBody.script), entries);
assert.deepEqual(JSON.parse(result.responseBody.draft), entries);
assert.equal(
  logCalls.some(
    ([message, details]) =>
      message === "[Creator Card Porter] react-state:matched" &&
      details.entryCount === 1 &&
      !("responseBody" in details),
  ),
  true,
  "page-console diagnostics should report safe script counts only",
);

const characterId = "169f0227-20fe-427b-8d3c-dad7f51e4276";
const characterFiber = {
  memoizedProps: {
    characterFormStore: {
      character: {
        id: characterId,
        creator_id: "creator-1",
        name: "Published name",
        description: "Published description",
        personality: "Published personality",
      },
      currentFormValues: {
        name: "Current editor name",
        description: "Current editor description",
        personality: "Current editor personality",
        scenario: "Current scenario",
        first_messages: ["Hello"],
        example_dialogs: "Example",
      },
    },
  },
  memoizedState: null,
  child: null,
  sibling: null,
  return: null,
};
const characterDocument = {
  documentElement: { __reactFiber$test: characterFiber },
  body: null,
  querySelectorAll: () => [],
};
const characterResult = helper.captureCurrentSource(
  { resourceType: "character", resourceId: characterId },
  characterDocument,
);

assert.equal(characterResult.captured, true);
assert.equal(characterResult.responseBody.character.id, characterId);
assert.equal(
  characterResult.responseBody.character.name,
  "Current editor name",
);
assert.equal(
  characterResult.responseBody.character.creator_id,
  "creator-1",
  "complete loaded source metadata should be preserved",
);

console.log("Janitor hydrated page-state checks passed.");
