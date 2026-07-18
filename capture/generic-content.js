(() => {
  const CONTENT_SCRIPT_VERSION = 1;
  if (
    globalThis.__creatorCardGenericCaptureInstalled === CONTENT_SCRIPT_VERSION
  ) {
    return;
  }
  globalThis.__creatorCardGenericCaptureInstalled = CONTENT_SCRIPT_VERSION;

  const STORAGE_KEY = "creatorCardCaptures";
  const STORAGE_FORMAT_KEY = "creatorCardStorageFormat";
  const STORAGE_FORMAT_VERSION = 2;
  let storagePreparation;

  const currentPageUrl = () =>
    `${window.location.origin}${window.location.pathname}`;

  const pageResourceId = () => {
    const value = currentPageUrl();
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `page-${(hash >>> 0).toString(16)}`;
  };

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

  const persistCapture = async (capture) => {
    try {
      const url = new URL(capture.url);
      if (
        capture.platform !== "other" ||
        capture.kind !== "editor-form" ||
        capture.resourceType !== "character" ||
        !["http:", "https:"].includes(url.protocol) ||
        url.origin !== window.location.origin
      ) {
        return {
          captured: false,
          error: "Other can only capture the current web page after you select it.",
        };
      }

      const signature = JSON.stringify({
        resourceId: capture.resourceId,
        responseBody: capture.responseBody,
      });
      let hash = 2166136261;
      for (let index = 0; index < signature.length; index += 1) {
        hash ^= signature.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      const resourceKey = `other:character:${capture.resourceId}`;
      const storedCapture = {
        ...capture,
        fingerprint: `other:${capture.resourceId}:${(hash >>> 0).toString(16)}`,
        resourceKey,
      };
      delete storedCapture.url;
      delete storedCapture.sourcePageUrl;

      await prepareStorage();
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      const previous = Array.isArray(stored[STORAGE_KEY])
        ? stored[STORAGE_KEY]
        : [];
      const next = [
        storedCapture,
        ...previous.filter((item) => item?.resourceKey !== resourceKey),
      ];
      await chrome.storage.local.set({ [STORAGE_KEY]: next });
      return { captured: true, error: null };
    } catch {
      return {
        captured: false,
        error:
          "The complete source could not be stored locally. Clear older captures or reduce the source size, then try again.",
      };
    }
  };

  const captureCurrentForm = async () => {
    const helper = globalThis.CreatorCardFormCapture;
    if (!helper) {
      return { captured: false, error: "The generic capture helper did not load." };
    }
    const fields = helper.collectCharacterEditorFields(document);
    if (!fields.length) {
      return {
        captured: false,
        error:
          "Other could not identify enough standard character fields. Open the character editor, expand its sections, and try again.",
      };
    }

    const character = helper.buildCharacterFromFields(fields);
    const editorImage = document.querySelector(
      '[data-testid*="avatar" i] img, img[alt*="avatar" i], img[alt*="character" i]',
    );
    const editorImageUrl = editorImage?.src || "";
    if (editorImageUrl && !character.avatar && !character.imageUrl) {
      character.avatar = editorImageUrl;
    }
    if (helper.characterScore(character) < 4) {
      return {
        captured: false,
        error:
          "Other found a form, but not enough recognizable character fields. Check the page and try a platform-specific adapter when available.",
      };
    }

    return await persistCapture({
      platform: "other",
      kind: "editor-form",
      resourceType: "character",
      resourceId: pageResourceId(),
      url: currentPageUrl(),
      method: "DOM",
      requestBody: null,
      responseBody: { character },
      sourcePageUrl: currentPageUrl(),
      capturedAt: new Date().toISOString(),
    });
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "CREATOR_CARD_GENERIC_CAPTURE_NOW") return false;
    void captureCurrentForm().then(sendResponse);
    return true;
  });
})();
