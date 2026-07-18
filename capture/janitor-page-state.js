(() => {
  const PAGE_STATE_HELPER_VERSION = 2;
  if (
    globalThis.CreatorCardJanitorPageState?.version ===
    PAGE_STATE_HELPER_VERSION
  ) {
    return;
  }

  const LOG_PREFIX = "[Creator Card Porter]";
  const log = (event, details = {}) => {
    console.info(`${LOG_PREFIX} ${event}`, details);
  };

  const isRecord = (value) =>
    typeof value === "object" && value !== null && !Array.isArray(value);

  const cloneJson = (value) => {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return null;
    }
  };

  const recordId = (value) =>
    typeof value?.id === "string"
      ? value.id
      : typeof value?.characterId === "string"
        ? value.characterId
        : typeof value?.character_id === "string"
          ? value.character_id
          : "";

  const characterScore = (value, expectedId) => {
    if (!isRecord(value)) return 0;
    const id = recordId(value);
    const fields = [
      "name",
      "description",
      "personality",
      "scenario",
      "first_message",
      "first_messages",
      "example_dialogs",
      "avatar",
    ];
    return (
      (id && id === expectedId ? 8 : id ? 1 : 0) +
      fields.reduce(
        (score, key) => score + (value[key] == null ? 0 : key === "name" ? 3 : 1),
        0,
      )
    );
  };

  const entryScore = (entry) => {
    if (!isRecord(entry)) return 0;
    return (
      (entry.id != null || entry.uid != null ? 2 : 0) +
      (typeof (entry.content ?? entry.entry ?? entry.text) === "string" ? 3 : 0) +
      (entry.key != null || entry.keys != null || entry.keywords != null ? 2 : 0) +
      (entry.constant != null ? 1 : 0) +
      (entry.enabled != null || entry.active != null ? 1 : 0)
    );
  };

  const parseEntries = (value) => {
    let parsed = value;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return [];
      }
    }
    const entries = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed)
        ? Object.keys(parsed)
            .sort((left, right) => {
              const leftNumber = Number.parseInt(left, 10);
              const rightNumber = Number.parseInt(right, 10);
              if (Number.isNaN(leftNumber) || Number.isNaN(rightNumber)) {
                return left.localeCompare(right);
              }
              return leftNumber - rightNumber;
            })
            .map((key) => parsed[key])
        : [];
    return entries.filter((entry) => entryScore(entry) >= 5);
  };

  const locateReactRoot = (documentValue) => {
    if (!documentValue) return null;
    const elements = [
      documentValue.documentElement,
      documentValue.body,
      ...Array.from(documentValue.querySelectorAll?.("*") || []).slice(0, 5_000),
    ].filter(Boolean);

    for (const element of elements) {
      const key = Object.keys(element).find(
        (name) =>
          name.startsWith("__reactFiber$") ||
          name.startsWith("__reactContainer$"),
      );
      if (!key) continue;
      let fiber = element[key]?.current || element[key];
      if (!fiber || typeof fiber !== "object") continue;
      while (fiber.return) fiber = fiber.return;
      return fiber;
    }
    return null;
  };

  const visitFibers = (root, visitor) => {
    if (!root) return;
    const stack = [root];
    const seen = new Set();
    while (stack.length && seen.size < 50_000) {
      const fiber = stack.pop();
      if (!fiber || seen.has(fiber)) continue;
      seen.add(fiber);
      visitor(fiber);
      if (fiber.sibling) stack.push(fiber.sibling);
      if (fiber.child) stack.push(fiber.child);
    }
  };

  const captureCharacter = (root, expectedId) => {
    let best = null;
    let bestScore = 0;

    visitFibers(root, (fiber) => {
      const props = fiber.memoizedProps;
      if (!isRecord(props)) return;
      const store = props.characterFormStore;
      const candidates = [];
      if (isRecord(store?.character)) {
        candidates.push({
          ...store.character,
          ...(isRecord(store.currentFormValues) ? store.currentFormValues : {}),
        });
      }
      if (isRecord(props.character)) candidates.push(props.character);
      if (isRecord(props.values)) candidates.push(props.values);

      candidates.forEach((candidate) => {
        const score = characterScore(candidate, expectedId);
        if (score > bestScore) {
          best = candidate;
          bestScore = score;
        }
      });
    });

    const character = bestScore >= 6 ? cloneJson(best) : null;
    if (!character) return null;
    if (!recordId(character)) character.id = expectedId;
    return { character, imageUrl: character.avatar || "" };
  };

  const entriesFromHooks = (fiber) => {
    let hook = fiber?.memoizedState;
    let inspected = 0;
    while (hook && inspected < 100) {
      const entries = parseEntries(hook.memoizedState);
      if (entries.length) return entries;
      hook = hook.next;
      inspected += 1;
    }
    return [];
  };

  const captureScript = (root, expectedId) => {
    let best = null;
    let bestScore = 0;

    visitFibers(root, (fiber) => {
      const props = fiber.memoizedProps;
      if (!isRecord(props)) return;
      const store = props.scriptStore;
      const currentScript = isRecord(store?.currentScript)
        ? store.currentScript
        : isRecord(props.currentScript)
          ? props.currentScript
          : null;
      const id = recordId(currentScript);
      const code =
        typeof store?.currentCode === "string"
          ? store.currentCode
          : typeof currentScript?.draft === "string" && currentScript.draft
            ? currentScript.draft
            : currentScript?.script;
      const codeEntries = parseEntries(code);
      const hookEntries = codeEntries.length ? [] : entriesFromHooks(fiber);
      const entries =
        codeEntries.length > 0
          ? codeEntries
          : hookEntries.length > 0
            ? hookEntries
            : parseEntries(props.initialEntries);
      const score =
        (id === expectedId ? 10 : id ? 1 : 0) +
        (currentScript?.type === "lorebook" ? 3 : 0) +
        (entries.length ? 8 : 0);
      if (score > bestScore) {
        best = { currentScript, entries };
        bestScore = score;
      }
    });

    if (!best || bestScore < 18 || !best.entries.length) return null;
    const original = cloneJson(best.currentScript) || {};
    const currentCode = JSON.stringify(cloneJson(best.entries), null, 2);
    return {
      ...original,
      id: recordId(original) || expectedId,
      type: original.type || "lorebook",
      script: currentCode,
      draft: currentCode,
    };
  };

  const captureCurrentSource = (
    { resourceType, resourceId },
    documentValue = globalThis.document,
  ) => {
    log("capture:start", { resourceType, resourceId });
    if (!resourceId || !["character", "script"].includes(resourceType)) {
      log("capture:invalid-context", { resourceType, hasResourceId: Boolean(resourceId) });
      return { captured: false, error: null };
    }
    const root = locateReactRoot(documentValue);
    if (!root) {
      log("react-state:root-missing", { resourceType, resourceId });
      return { captured: false, error: null };
    }
    const responseBody =
      resourceType === "script"
        ? captureScript(root, resourceId)
        : captureCharacter(root, resourceId);
    if (!responseBody) {
      log("react-state:source-missing", { resourceType, resourceId });
      return { captured: false, error: null };
    }

    if (resourceType === "script") {
      log("react-state:matched", {
        resourceType,
        resourceId,
        fieldCount: Object.keys(responseBody).length,
        entryCount: parseEntries(responseBody.script).length,
        scriptType: responseBody.type || "unknown",
      });
    } else {
      const character = responseBody.character || {};
      log("react-state:matched", {
        resourceType,
        resourceId,
        fieldCount: Object.values(character).filter((value) => value != null)
          .length,
        hasName: typeof character.name === "string" && character.name.length > 0,
      });
    }
    return { captured: true, responseBody };
  };

  globalThis.CreatorCardJanitorPageState = {
    version: PAGE_STATE_HELPER_VERSION,
    captureCurrentSource,
    log,
    parseEntries,
  };
})();
