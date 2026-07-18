(() => {
  const CONTENT_SCRIPT_VERSION = 4;
  if (
    globalThis.__creatorCardCaptureContentInstalled === CONTENT_SCRIPT_VERSION
  ) {
    return;
  }
  globalThis.__creatorCardCaptureContentInstalled = CONTENT_SCRIPT_VERSION;

  const STORAGE_KEY = "creatorCardCaptures";
  const STORAGE_FORMAT_KEY = "creatorCardStorageFormat";
  const STORAGE_FORMAT_VERSION = 2;
  let storagePreparation;

  const log = (event, details = {}) => {
    console.info(`[Creator Card Porter] ${event}`, details);
  };

  const isRecord = (value) =>
    typeof value === "object" && value !== null && !Array.isArray(value);

  const currentPageUrl = () =>
    `${window.location.origin}${window.location.pathname}`;

  const prepareStorage = () => {
    if (!storagePreparation) {
      storagePreparation = (async () => {
        const stored = await chrome.storage.local.get(STORAGE_FORMAT_KEY);
        if (stored[STORAGE_FORMAT_KEY] === STORAGE_FORMAT_VERSION) return;
        await chrome.storage.local.set({
          [STORAGE_FORMAT_KEY]: STORAGE_FORMAT_VERSION,
        });
      })();
    }
    return storagePreparation;
  };

  const isAllowedCapture = (capture) => {
    if (!isRecord(capture) || capture.platform !== "janitorai") return false;
    if (typeof capture.url !== "string") return false;
    try {
      const url = new URL(capture.url);
      const allowedHost =
        url.hostname === "janitorai.com" ||
        url.hostname === "www.janitorai.com" ||
        url.hostname === "jannyai.com" ||
        url.hostname === "www.jannyai.com";
      const allowedPageProps =
        capture.kind === "page-props" &&
        (capture.resourceType === "character" ||
          capture.resourceType === "script") &&
        (/\/characters(?:\/|$)/.test(url.pathname) ||
          /\/edit_character\/[a-f0-9-]{36}(?:\/|$)/i.test(url.pathname) ||
          /\/scripts\/[a-f0-9-]{36}\/edit(?:\/|$)/i.test(url.pathname));
      const allowedEditorForm =
        capture.kind === "editor-form" &&
        capture.resourceType === "character" &&
        /\/edit_character\/[a-f0-9-]{36}(?:\/|$)/i.test(url.pathname);
      const allowedPageState =
        capture.kind === "page-state" &&
        ((capture.resourceType === "character" &&
          /\/edit_character\/[a-f0-9-]{36}(?:\/|$)/i.test(url.pathname)) ||
          (capture.resourceType === "script" &&
            /\/scripts\/[a-f0-9-]{36}\/edit(?:\/|$)/i.test(url.pathname)));
      return (
        allowedHost &&
        (allowedPageProps || allowedEditorForm || allowedPageState)
      );
    } catch {
      return false;
    }
  };

  const captureResourceKey = (capture) => {
    if (capture?.resourceType && capture?.resourceId) {
      return `${capture.resourceType}:${capture.resourceId}`;
    }
    const candidates = [capture?.url, capture?.sourcePageUrl].filter(Boolean);
    for (const rawUrl of candidates) {
      try {
        const path = new URL(rawUrl).pathname;
        const scriptId =
          path.match(/\/hampter\/script\/([a-f0-9-]{36})(?:\/|$)/i)?.[1] ||
          path.match(/\/scripts\/([a-f0-9-]{36})\/edit(?:\/|$)/i)?.[1];
        if (scriptId) return `script:${scriptId}`;
        const characterId =
          path.match(/\/hampter\/characters\/([a-f0-9-]{36})(?:\/|$)/i)?.[1] ||
          path.match(/\/characters\/([a-f0-9-]{36})(?:_|\/|$)/i)?.[1] ||
          path.match(/\/edit_character\/([a-f0-9-]{36})(?:\/|$)/i)?.[1];
        if (characterId) return `character:${characterId}`;
      } catch {
        // Ignore malformed candidate URLs.
      }
    }
    return "";
  };

  const persistCapture = async (capture) => {
    if (!isAllowedCapture(capture)) {
      log("cache:rejected", {
        resourceType: capture?.resourceType || "unknown",
        resourceId: capture?.resourceId || null,
        source: capture?.kind || "unknown",
        reason: "unsupported-source",
      });
      return {
        captured: false,
        error: "The current page did not provide a supported creator source.",
      };
    }

    try {
      const signature = JSON.stringify({
        resourceType: capture.resourceType,
        resourceId: capture.resourceId,
        method: capture.method,
        kind: capture.kind,
        requestBody: capture.requestBody,
        responseBody: capture.responseBody,
      });
      let hash = 2166136261;
      for (let index = 0; index < signature.length; index += 1) {
        hash ^= signature.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      const fingerprint = [
        capture.resourceType || "unknown",
        capture.resourceId || "unknown",
        capture.method,
        capture.kind,
        (hash >>> 0).toString(16),
      ].join(":");
      const resourceKey = captureResourceKey(capture);
      const storedCapture = { ...capture };
      delete storedCapture.url;
      delete storedCapture.sourcePageUrl;

      await prepareStorage();
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      const previous = Array.isArray(stored[STORAGE_KEY])
        ? stored[STORAGE_KEY]
        : [];
      const next = [
        { ...storedCapture, fingerprint, resourceKey: resourceKey || null },
        ...previous.filter(
          (item) =>
            item?.fingerprint !== fingerprint &&
            (!resourceKey ||
              (item?.resourceKey || captureResourceKey(item)) !== resourceKey),
        ),
      ];
      await chrome.storage.local.set({ [STORAGE_KEY]: next });
      log("cache:stored", {
        resourceType: capture.resourceType,
        resourceId: capture.resourceId,
        source: capture.kind,
        cachedResourceCount: next.length,
      });
      return { captured: true, error: null };
    } catch {
      log("cache:write-failed", {
        resourceType: capture.resourceType,
        resourceId: capture.resourceId,
        source: capture.kind,
        reason: "local-storage-write-failed",
      });
      return {
        captured: false,
        error:
          "The complete source could not be stored locally. Clear older captures or reduce the source size, then try again.",
      };
    }
  };

  const decodeAstroValue = (value) => {
    if (!Array.isArray(value)) return value;
    const [type, data] = value;
    if (type === 0) {
      if (isRecord(data)) {
        return Object.fromEntries(
          Object.entries(data).map(([key, nested]) => [
            key,
            decodeAstroValue(nested),
          ]),
        );
      }
      return data;
    }
    if (type === 1 && Array.isArray(data)) {
      return data.map(decodeAstroValue);
    }
    return data;
  };

  const findScriptRecord = (root) => {
    let best = null;
    let bestScore = 0;
    const seen = new Set();

    const visit = (value, depth) => {
      if (depth > 5 || value == null || seen.has(value)) return;
      if (isRecord(value)) {
        seen.add(value);
        const score =
          (typeof value.script === "string" || Array.isArray(value.script)
            ? 6
            : 0) +
          (value.type === "lorebook" ? 3 : 0) +
          (typeof value.title === "string" ? 1 : 0) +
          (typeof value.id === "string" ? 1 : 0);
        if (score > bestScore) {
          best = value;
          bestScore = score;
        }
        Object.values(value).forEach((nested) => visit(nested, depth + 1));
      } else if (Array.isArray(value)) {
        value.slice(0, 30).forEach((nested) => visit(nested, depth + 1));
      }
    };

    visit(root, 0);
    return bestScore >= 6 ? best : null;
  };

  const findCharacterRecord = (root) => {
    let best = null;
    let bestScore = 0;
    const seen = new Set();
    const visit = (value, depth) => {
      if (depth > 6 || value == null || seen.has(value)) return;
      if (isRecord(value)) {
        seen.add(value);
        const score = [
          "name",
          "personality",
          "scenario",
          "firstMessage",
          "first_message",
          "exampleDialogs",
          "example_dialogs",
          "description",
          "avatar",
        ].reduce(
          (total, key) =>
            total + (value[key] == null ? 0 : key === "name" ? 3 : 1),
          0,
        );
        if (score > bestScore) {
          best = value;
          bestScore = score;
        }
        Object.values(value).forEach((nested) => visit(nested, depth + 1));
      } else if (Array.isArray(value)) {
        value.slice(0, 30).forEach((nested) => visit(nested, depth + 1));
      }
    };
    visit(root, 0);
    return bestScore >= 4 ? best : null;
  };

  const captureCharacterProps = async (islands) => {
    for (const island of islands) {
      const raw = island.getAttribute("props");
      if (!raw || !raw.includes("character")) continue;
      try {
        const props = JSON.parse(raw);
        const character = decodeAstroValue(props.character);
        if (!isRecord(character)) continue;
        return await persistCapture({
          platform: "janitorai",
          kind: "page-props",
          resourceType: "character",
          resourceId: characterIdFromCurrentPage(),
          url: currentPageUrl(),
          method: "GET",
          requestBody: null,
          responseBody: {
            character,
            imageUrl: decodeAstroValue(props.imageUrl),
          },
          sourcePageUrl: currentPageUrl(),
          capturedAt: new Date().toISOString(),
        });
      } catch {
        // A different Astro island can carry unrelated serialized props.
      }
    }
    return { captured: false, error: null };
  };

  const captureScriptProps = async (islands) => {
    if (
      !/\/scripts\/[a-f0-9-]{36}\/edit(?:\/|$)/i.test(window.location.pathname)
    ) {
      return { captured: false, error: null };
    }
    for (const island of islands) {
      const raw = island.getAttribute("props");
      if (!raw || !raw.includes("script")) continue;
      try {
        const props = JSON.parse(raw);
        const decoded = Object.fromEntries(
          Object.entries(props).map(([key, value]) => [
            key,
            decodeAstroValue(value),
          ]),
        );
        const script = findScriptRecord(decoded);
        if (!script) continue;
        return await persistCapture({
          platform: "janitorai",
          kind: "page-props",
          resourceType: "script",
          resourceId: scriptIdFromCurrentPage(),
          url: currentPageUrl(),
          method: "GET",
          requestBody: null,
          responseBody: script,
          sourcePageUrl: currentPageUrl(),
          capturedAt: new Date().toISOString(),
        });
      } catch {
        // A different Astro island can carry unrelated serialized props.
      }
    }
    return { captured: false, error: null };
  };

  const captureAstroProps = async () => {
    const islands = Array.from(document.querySelectorAll("astro-island[props]"));
    const characterResult = await captureCharacterProps(islands);
    const scriptResult = await captureScriptProps(islands);
    return {
      captured: characterResult.captured || scriptResult.captured,
      error: characterResult.error || scriptResult.error,
    };
  };

  const captureAstroPropsWhenReady = async (timeoutMs = 2_000) => {
    const immediate = await captureAstroProps();
    if (immediate.captured || immediate.error) return immediate;

    return new Promise((resolve) => {
      let finished = false;
      let checking = false;

      const finish = (result) => {
        if (finished) return;
        finished = true;
        observer.disconnect();
        window.clearTimeout(timeout);
        resolve(result);
      };

      const check = async () => {
        if (finished || checking) return;
        checking = true;
        const result = await captureAstroProps();
        checking = false;
        if (result.captured || result.error) finish(result);
      };

      const observer = new MutationObserver(() => void check());
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
      const timeout = window.setTimeout(
        () => finish({ captured: false, error: null }),
        timeoutMs,
      );
      void check();
    });
  };

  const scriptIdFromCurrentPage = () =>
    window.location.pathname.match(
      /\/scripts\/([a-f0-9-]{36})\/edit(?:\/|$)/i,
    )?.[1] || "";

  const characterIdFromCurrentPage = () =>
    window.location.pathname.match(
      /\/characters\/([a-f0-9-]{36})(?:_|\/|$)/i,
    )?.[1] ||
    window.location.pathname.match(
      /\/edit_character\/([a-f0-9-]{36})(?:\/|$)/i,
    )?.[1] ||
    "";

  const captureCharacterEditorForm = async () => {
    const characterId = characterIdFromCurrentPage();
    const helper = globalThis.CreatorCardFormCapture;
    if (!characterId || !helper) return { captured: false, error: null };

    const fields = helper.collectCharacterEditorFields(document);
    if (!fields.length) return { captured: false, error: null };
    const character = helper.buildCharacterFromFields(fields);
    const editorImage = document.querySelector(
      'img[src*="/bot-avatars/"], img[src*="image.jannyai.com/bot-avatars"]',
    );
    const editorImageUrl = editorImage?.getAttribute("src") || "";
    if (editorImageUrl && !character.avatar && !character.imageUrl) {
      character.avatar = editorImageUrl;
    }
    if (helper.characterScore(character) < 4) {
      return { captured: false, error: null };
    }

    return await persistCapture({
      platform: "janitorai",
      kind: "editor-form",
      resourceType: "character",
      resourceId: characterId,
      url: currentPageUrl(),
      method: "DOM",
      requestBody: null,
      responseBody: { character },
      sourcePageUrl: currentPageUrl(),
      capturedAt: new Date().toISOString(),
    });
  };

  const captureCharacterEditorFormWhenReady = async (timeoutMs = 4_000) => {
    const immediate = await captureCharacterEditorForm();
    if (immediate.captured || immediate.error) return immediate;

    return new Promise((resolve) => {
      let finished = false;
      let checking = false;
      const finish = (result) => {
        if (finished) return;
        finished = true;
        window.clearInterval(interval);
        window.clearTimeout(timeout);
        resolve(result);
      };
      const check = async () => {
        if (finished || checking) return;
        checking = true;
        const result = await captureCharacterEditorForm();
        checking = false;
        if (result.captured || result.error) finish(result);
      };
      const interval = window.setInterval(() => void check(), 250);
      const timeout = window.setTimeout(
        () => finish({ captured: false, error: null }),
        timeoutMs,
      );
      void check();
    });
  };

  const persistPageStateCapture = async ({
    resourceType,
    resourceId,
    responseBody,
  }) => {
    const expectedId =
      resourceType === "script"
        ? scriptIdFromCurrentPage()
        : resourceType === "character"
          ? characterIdFromCurrentPage()
          : "";
    const containsSource =
      resourceType === "script"
        ? Boolean(findScriptRecord(responseBody))
        : Boolean(findCharacterRecord(responseBody));
    if (!expectedId || resourceId !== expectedId || !containsSource) {
      log("page-state:rejected", {
        resourceType,
        resourceId,
        matchesCurrentPage: Boolean(expectedId && resourceId === expectedId),
        containsSource,
      });
      return {
        captured: false,
        error: "The loaded editor state did not contain the selected source.",
      };
    }
    return await persistCapture({
      platform: "janitorai",
      kind: "page-state",
      resourceType,
      resourceId,
      url: currentPageUrl(),
      method: "PAGE_STATE",
      requestBody: null,
      responseBody,
      sourcePageUrl: currentPageUrl(),
      capturedAt: new Date().toISOString(),
    });
  };

  const captureCurrentPage = async () => {
    const characterId = characterIdFromCurrentPage();
    const scriptId = scriptIdFromCurrentPage();
    const resourceType = characterId ? "character" : scriptId ? "script" : "unknown";
    const resourceId = characterId || scriptId || null;
    log("fallback:start", { resourceType, resourceId });
    let characterResult = characterId
      ? await captureAstroPropsWhenReady()
      : await captureAstroProps();
    log("fallback:page-props-result", {
      resourceType,
      resourceId,
      captured: Boolean(characterResult.captured),
      hasError: Boolean(characterResult.error),
    });
    if (
      characterId &&
      !characterResult.captured &&
      !characterResult.error
    ) {
      log("fallback:editor-form-start", { resourceType, resourceId });
      characterResult = await captureCharacterEditorFormWhenReady();
      log("fallback:editor-form-result", {
        resourceType,
        resourceId,
        captured: Boolean(characterResult.captured),
        hasError: Boolean(characterResult.error),
      });
    }
    const captured = characterResult.captured;
    const captureError = characterResult.error;
    const result = {
      captured,
      error: captured
        ? null
        : captureError ||
          (characterId
            ? "No supported character data was found in the page props or current editor fields. Confirm the editor is fully loaded, then try again."
            : "No supported character or lorebook fields were found on this page."),
      warning: captured ? captureError : null,
    };
    log("fallback:complete", {
      resourceType,
      resourceId,
      captured,
      reason: result.error || result.warning || null,
    });
    return result;
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "CREATOR_CARD_CAPTURE_NOW") {
      void captureCurrentPage().then(sendResponse);
      return true;
    }
    if (message?.type === "CREATOR_CARD_PERSIST_PAGE_STATE") {
      void persistPageStateCapture(message).then(sendResponse);
      return true;
    }
    return false;
  });
})();
