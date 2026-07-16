(() => {
  if (globalThis.__creatorCardPorterCaptureContentInstalled) return;
  globalThis.__creatorCardPorterCaptureContentInstalled = true;

  const MESSAGE_TYPE = "CREATOR_CARD_PORTER_CAPTURE";
  const STORAGE_KEY = "creatorCardPorterCaptures";
  const MAX_CAPTURES = 12;
  const MAX_CAPTURE_BYTES = 1_500_000;

  const isRecord = (value) =>
    typeof value === "object" && value !== null && !Array.isArray(value);

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
        (/\/characters(?:\/|$)/.test(url.pathname) ||
          /\/edit_character\/[a-f0-9-]{36}(?:\/|$)/i.test(url.pathname) ||
          /\/scripts\/[a-f0-9-]{36}\/edit(?:\/|$)/i.test(url.pathname));
      return (
        allowedHost &&
        (allowedPageProps ||
          /\/hampter\/characters(?:\/|$)/.test(url.pathname) ||
          /\/api\/characters(?:\/|$)/.test(url.pathname) ||
          /\/hampter\/script\/[a-f0-9-]{36}(?:\/|$)/i.test(url.pathname) ||
          /\/api\/scripts?(?:\/|$)/i.test(url.pathname))
      );
    } catch {
      return false;
    }
  };

  const captureResourceKey = (capture) => {
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
    if (!isAllowedCapture(capture)) return;
    const serialized = JSON.stringify(capture);
    if (serialized.length > MAX_CAPTURE_BYTES) return;

    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const previous = Array.isArray(stored[STORAGE_KEY])
      ? stored[STORAGE_KEY]
      : [];
    const signature = JSON.stringify({
      url: capture.url,
      method: capture.method,
      kind: capture.kind,
      resourceType: capture.resourceType,
      requestBody: capture.requestBody,
      responseBody: capture.responseBody,
    });
    let hash = 2166136261;
    for (let index = 0; index < signature.length; index += 1) {
      hash ^= signature.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    const fingerprint = [
      capture.url,
      capture.method,
      capture.kind,
      capture.resourceType || "unknown",
      (hash >>> 0).toString(16),
    ].join(":");
    const resourceKey = captureResourceKey(capture);
    const next = [
      { ...capture, fingerprint, resourceKey: resourceKey || null },
      ...previous.filter(
        (item) =>
          item?.fingerprint !== fingerprint &&
          (!resourceKey ||
            (item?.resourceKey || captureResourceKey(item)) !== resourceKey),
      ),
    ].slice(0, MAX_CAPTURES);
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
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

  const captureCharacterProps = async (islands) => {
    for (const island of islands) {
      const raw = island.getAttribute("props");
      if (!raw || !raw.includes("character")) continue;
      try {
        const props = JSON.parse(raw);
        const character = decodeAstroValue(props.character);
        if (!isRecord(character)) continue;
        await persistCapture({
          platform: "janitorai",
          kind: "page-props",
          resourceType: "character",
          url: window.location.href,
          method: "GET",
          requestBody: null,
          responseBody: {
            character,
            imageUrl: decodeAstroValue(props.imageUrl),
          },
          sourcePageUrl: window.location.href,
          capturedAt: new Date().toISOString(),
        });
        return true;
      } catch {
        // A different Astro island can carry unrelated serialized props.
      }
    }
    return false;
  };

  const captureScriptProps = async (islands) => {
    if (
      !/\/scripts\/[a-f0-9-]{36}\/edit(?:\/|$)/i.test(window.location.pathname)
    ) {
      return false;
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
        await persistCapture({
          platform: "janitorai",
          kind: "page-props",
          resourceType: "script",
          url: window.location.href,
          method: "GET",
          requestBody: null,
          responseBody: script,
          sourcePageUrl: window.location.href,
          capturedAt: new Date().toISOString(),
        });
        return true;
      } catch {
        // A different Astro island can carry unrelated serialized props.
      }
    }
    return false;
  };

  const captureAstroProps = async () => {
    const islands = Array.from(document.querySelectorAll("astro-island[props]"));
    const characterCaptured = await captureCharacterProps(islands);
    const scriptCaptured = await captureScriptProps(islands);
    return characterCaptured || scriptCaptured;
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

  const captureCurrentScriptEndpoint = async () => {
    const scriptId = scriptIdFromCurrentPage();
    if (!scriptId) return { captured: false, error: null };

    const url = new URL(`/hampter/script/${scriptId}`, window.location.origin);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        return {
          captured: false,
          error: `JanitorAI returned HTTP ${response.status} for this script.`,
        };
      }
      const responseBody = await response.json();
      await persistCapture({
        platform: "janitorai",
        kind: "manual-network",
        resourceType: "script",
        url: url.href,
        method: "GET",
        requestBody: null,
        responseBody,
        sourcePageUrl: window.location.href,
        capturedAt: new Date().toISOString(),
      });
      return { captured: true, error: null };
    } catch {
      return {
        captured: false,
        error: "The current script request could not be read.",
      };
    }
  };

  const captureCurrentPage = async () => {
    const propsCaptured = await captureAstroProps();
    const scriptResult = await captureCurrentScriptEndpoint();
    const captured = propsCaptured || scriptResult.captured;
    return {
      captured,
      error: captured ? null : scriptResult.error,
      reloadRequired: Boolean(characterIdFromCurrentPage()) && !captured,
    };
  };

  window.addEventListener("message", (event) => {
    if (
      event.source !== window ||
      event.origin !== window.location.origin ||
      event.data?.type !== MESSAGE_TYPE
    ) {
      return;
    }
    void persistCapture(event.data.capture);
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "CREATOR_CARD_PORTER_CAPTURE_NOW") return false;
    void captureCurrentPage().then(sendResponse);
    return true;
  });

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => void captureAstroProps(),
      { once: true },
    );
  } else {
    void captureAstroProps();
  }
})();
