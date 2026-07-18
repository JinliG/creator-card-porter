(() => {
  const STORAGE_KEY = "creatorCardCaptures";
  const STORAGE_FORMAT_KEY = "creatorCardStorageFormat";
  const SELECTED_PLATFORM_KEY = "creatorCardSelectedPlatform";
  const STORAGE_FORMAT_VERSION = 2;
  const state = { document: null, captures: [] };
  let storagePreparation;

  const elements = {
    captureStatus: document.querySelector("#capture-status"),
    captureFeedback: document.querySelector("#capture-feedback"),
    platform: document.querySelector("#platform"),
    platformWarning: document.querySelector("#platform-warning"),
    emptyState: document.querySelector("#empty-state"),
    emptyTitle: document.querySelector("#empty-title"),
    emptyDescription: document.querySelector("#empty-description"),
    result: document.querySelector("#result"),
    characterName: document.querySelector("#character-name"),
    mappingList: document.querySelector("#mapping-list"),
    unmappedNote: document.querySelector("#unmapped-note"),
    jsonOutput: document.querySelector("#json-output"),
    sourcePreview: document.querySelector("#source-preview"),
    previewPanel: document.querySelector("#preview-panel"),
    mappingPanel: document.querySelector("#mapping-panel"),
    jsonPanel: document.querySelector("#json-panel"),
    copy: document.querySelector("#copy"),
    download: document.querySelector("#download"),
    captureCurrent: document.querySelector("#capture-current"),
    clearCaptures: document.querySelector("#clear-captures"),
    diagnostics: document.querySelector("#diagnostics"),
    tabs: Array.from(document.querySelectorAll("[data-tab]")),
  };

  const setStatus = (label, variant = "idle") => {
    elements.captureStatus.textContent = label;
    elements.captureStatus.className = `status status--${variant}`;
  };

  const setCaptureFeedback = (message = "") => {
    elements.captureFeedback.hidden = !message;
    elements.captureFeedback.textContent = message;
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

  const pageContextFromUrl = (rawUrl, platform) => {
    try {
      const url = new URL(rawUrl);
      if (platform === "other") {
        const webStorePage =
          url.hostname === "chromewebstore.google.com" ||
          (url.hostname === "chrome.google.com" &&
            url.pathname.startsWith("/webstore"));
        return ["http:", "https:"].includes(url.protocol) && !webStorePage
          ? { type: "character", id: null }
          : null;
      }
      const supportedHost = [
        "janitorai.com",
        "www.janitorai.com",
        "jannyai.com",
        "www.jannyai.com",
      ].includes(url.hostname);
      if (!supportedHost) return null;
      const scriptId = url.pathname.match(
        /\/scripts\/([a-f0-9-]{36})\/edit(?:\/|$)/i,
      )?.[1];
      if (scriptId) return { type: "script", id: scriptId };
      const characterId =
        url.pathname.match(
          /\/characters\/([a-f0-9-]{36})(?:_|\/|$)/i,
        )?.[1] ||
        url.pathname.match(
          /\/edit_character\/([a-f0-9-]{36})(?:\/|$)/i,
        )?.[1];
      if (characterId) return { type: "character", id: characterId };
      return null;
    } catch {
      return null;
    }
  };

  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const valueAtPath = (documentValue, path) => {
    let value = documentValue.form;
    for (const key of path.split(".")) {
      if (!value || typeof value !== "object" || !(key in value)) return null;
      value = value[key];
    }
    return value;
  };

  const previewValue = (value) => {
    if (Array.isArray(value)) {
      if (!value.length) return "No imported value";
      const names = value
        .map((item) =>
          item && typeof item === "object" && typeof item.name === "string"
            ? item.name
            : String(item),
        )
        .slice(0, 3)
        .join(", ");
      return `${value.length} item${value.length === 1 ? "" : "s"}: ${names}${value.length > 3 ? "..." : ""}`;
    }
    if (typeof value !== "string") return "No imported value";
    const compact = value.replace(/\s+/g, " ").trim();
    if (!compact) return "No imported value";
    return compact.length > 90 ? `${compact.slice(0, 87)}...` : compact;
  };

  const sourceFieldPriority = new Map(
    [
      "name",
      "description",
      "personality",
      "scenario",
      "firstMessage",
      "first_message",
      "exampleDialogs",
      "example_dialogs",
      "avatar",
      "imageUrl",
      "tags",
      "tagIds",
      "scripts",
    ].map((key, index) => [key, index]),
  );

  const compactSourceValue = (key, value) => {
    if (key === "_capturedFormFields" && Array.isArray(value)) {
      return `${value.length} editor fields captured`;
    }
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (Array.isArray(value)) {
      if (!value.length) return "Empty array";
      const samples = value
        .slice(0, 3)
        .map((item) => {
          if (item && typeof item === "object") {
            return item.name || item.title || item.id || "object";
          }
          return String(item);
        })
        .join(", ");
      return `${value.length} items${samples ? ` · ${samples}` : ""}`;
    }
    if (typeof value === "object") {
      const serialized = JSON.stringify(value);
      return serialized.length > 180
        ? `${serialized.slice(0, 177)}...`
        : serialized;
    }
    const compact = String(value).replace(/\s+/g, " ").trim();
    if (!compact) return "Empty value";
    return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
  };

  const sourceFieldRows = (data) =>
    Object.entries(data || {})
      .sort(([left], [right]) => {
        const leftPriority = sourceFieldPriority.get(left) ?? 1_000;
        const rightPriority = sourceFieldPriority.get(right) ?? 1_000;
        return leftPriority - rightPriority || left.localeCompare(right);
      })
      .map(
        ([key, value]) => `
          <div class="source-field-row" title="${escapeHtml(key)}">
            <code>${escapeHtml(key)}</code>
            <span>${escapeHtml(compactSourceValue(key, value))}</span>
          </div>`,
      )
      .join("");

  const scriptEntryCount = (data) => {
    let script = data?.script;
    if (typeof script === "string") {
      try {
        script = JSON.parse(script);
      } catch {
        return null;
      }
    }
    if (script && !Array.isArray(script) && Array.isArray(script.entries)) {
      script = script.entries;
    }
    return Array.isArray(script) ? script.length : null;
  };

  const renderSourcePreview = (documentValue) => {
    const source = documentValue.source;
    const character = source.character;
    const scripts = source.scripts;
    const capturedAt = new Date(source.capturedAt);
    const capturedAtLabel = Number.isNaN(capturedAt.getTime())
      ? source.capturedAt
      : capturedAt.toLocaleString();
    const fields = character ? Object.keys(character.data).length : 0;
    const characterRows = character
      ? sourceFieldRows(character.data)
      : '<p class="source-empty">No character source has been captured in this set.</p>';
    const scriptCards = scripts.length
      ? scripts
          .map((script, index) => {
            const data = script.data || {};
            const title = data.title || data.name || `Script ${index + 1}`;
            const entries = scriptEntryCount(data);
            const detail = [
              script.captureKind,
              entries === null
                ? null
                : `${entries} ${entries === 1 ? "entry" : "entries"}`,
            ]
              .filter(Boolean)
              .join(" · ");
            return `
              <article class="source-script-card">
                <div>
                  <strong>${escapeHtml(title)}</strong>
                  <small>${escapeHtml(detail || "Captured source")}</small>
                </div>
                <code>${escapeHtml(script.resourceId || "no id")}</code>
              </article>`;
          })
          .join("")
      : '<p class="source-empty">No separate Scripts source has been captured.</p>';

    elements.sourcePreview.innerHTML = `
      <div class="source-preview-scroll">
        <div class="source-provenance">
          <div class="source-provenance__item">
            <span>Platform</span>
            <strong>${escapeHtml(source.platform)}</strong>
          </div>
          <div class="source-provenance__item">
            <span>Capture</span>
            <strong>${escapeHtml(source.captureKind)}</strong>
          </div>
          <div class="source-provenance__item" title="${escapeHtml(source.capturedAt)}">
            <span>Captured</span>
            <strong>${escapeHtml(capturedAtLabel)}</strong>
          </div>
        </div>
        <section class="source-section">
          <div class="source-section__heading">
            <strong>Character source</strong>
            <span>${fields} fields</span>
          </div>
          ${characterRows}
        </section>
        <section class="source-section">
          <div class="source-section__heading">
            <strong>Scripts source</strong>
            <span>${scripts.length} captured</span>
          </div>
          ${scriptCards}
        </section>
      </div>`;
  };

  const renderMapping = (mapping, documentValue) => {
    elements.mappingList.innerHTML = mapping
      .map((entry) => {
        const source = entry.sourceFields.length
          ? entry.sourceFields.join(" + ")
          : "no equivalent";
        const value = previewValue(
          valueAtPath(documentValue, entry.targetField),
        );
        return `
          <div class="mapping-row" title="${escapeHtml(entry.note)}">
            <code>${escapeHtml(source)}</code>
            <span class="mapping-row__target">
              <span>${escapeHtml(entry.targetField)}</span>
              <small>${escapeHtml(value)}</small>
            </span>
            <span class="mapping-state mapping-state--${escapeHtml(entry.status)}">${escapeHtml(entry.status)}</span>
          </div>`;
      })
      .join("");
  };

  const renderDocument = (documentValue, captures) => {
    state.document = documentValue;
    state.captures = captures;
    elements.emptyState.hidden = true;
    elements.result.hidden = false;
    elements.copy.disabled = false;
    elements.download.disabled = false;
    const characterName = documentValue.form.basicInfo.name;
    const playbookCount = documentValue.form.playbook.length;
    const hasCharacterSource = Boolean(documentValue.source.character);
    const characterFieldCount = hasCharacterSource
      ? Object.keys(documentValue.source.character.data || {}).length
      : 0;
    elements.characterName.textContent = characterName
      ? `${characterName}${playbookCount ? ` · ${playbookCount} Playbook` : ""}`
      : hasCharacterSource
        ? `Character source · ${characterFieldCount} fields`
        : `Lorebook only · ${playbookCount} entries`;
    elements.jsonOutput.textContent = JSON.stringify(documentValue, null, 2);
    renderSourcePreview(documentValue);
    renderMapping(documentValue.mapping, documentValue);
    if (documentValue.unmapped.length) {
      elements.unmappedNote.hidden = false;
      elements.unmappedNote.textContent = documentValue.unmapped
        .map((item) => `${item.sourceField}: ${item.reason}`)
        .join("\n");
    } else {
      elements.unmappedNote.hidden = true;
      elements.unmappedNote.textContent = "";
    }
    elements.diagnostics.hidden = captures.length === 0;
    setStatus("Ready", "ready");
  };

  const renderEmpty = ({ title, description, captures = [], status = "Waiting" }) => {
    state.document = null;
    state.captures = captures;
    elements.emptyTitle.textContent = title;
    elements.emptyDescription.textContent = description;
    elements.emptyState.hidden = false;
    elements.result.hidden = true;
    elements.copy.disabled = true;
    elements.download.disabled = true;
    elements.diagnostics.hidden = captures.length === 0;
    setStatus(status, status === "Waiting" ? "idle" : "error");
  };

  const loadLatestCapture = async () => {
    await prepareStorage();
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const captures = Array.isArray(stored[STORAGE_KEY])
      ? stored[STORAGE_KEY]
      : [];
    const platform = elements.platform.value;
    const platformCaptures = captures.filter(
      (capture) => capture?.platform === platform,
    );
    const adapter =
      platform === "other"
        ? globalThis.CreatorCardGenericAdapter
        : globalThis.CreatorCardJanitorAdapter;
    const characterCapture = platformCaptures.find((capture) =>
      Boolean(adapter.resolveCharacter(capture)),
    );
    const scriptCaptures = platformCaptures.filter((capture) =>
      Boolean(adapter.resolveScript(capture)),
    );
    try {
      const diagnosticCaptures = [
        ...(characterCapture ? [characterCapture] : []),
        ...scriptCaptures,
      ];
      if (characterCapture) {
        renderDocument(
          adapter.buildDocument(characterCapture, scriptCaptures),
          diagnosticCaptures,
        );
        return true;
      }
      if (scriptCaptures.length) {
        renderDocument(
          adapter.buildDocument(null, scriptCaptures),
          scriptCaptures,
        );
        return true;
      }
    } catch {
      // Captures can be metadata-only until the creator page finishes loading.
    }
    renderEmpty({
      title:
        platform === "other"
          ? "No generic character form captured yet"
          : "No character or lorebook captured yet",
      description:
        platform === "other"
          ? "Open a character editor with its fields visible, then use Capture current page."
          : "Open a JanitorAI character or Scripts edit page, then use Capture current page.",
      captures: platformCaptures,
      status: platformCaptures.length ? "Incomplete" : "Waiting",
    });
    return false;
  };

  const captureJanitorPageState = async (tabId, pageContext) => {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        files: ["capture/janitor-page-state.js"],
      });
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: (context) =>
          globalThis.CreatorCardJanitorPageState?.captureCurrentSource(
            context,
          ) || { captured: false, error: null },
        args: [
          {
            resourceType: pageContext.type,
            resourceId: pageContext.id,
          },
        ],
      });
      const pageState = results.find((entry) => entry?.result)?.result;
      if (!pageState?.captured || !pageState.responseBody) {
        await logJanitorPageEvent(tabId, "capture:page-state-miss", {
          resourceType: pageContext.type,
          resourceId: pageContext.id,
        });
        return null;
      }
      const persisted = await chrome.tabs.sendMessage(tabId, {
        type: "CREATOR_CARD_PERSIST_PAGE_STATE",
        resourceType: pageContext.type,
        resourceId: pageContext.id,
        responseBody: pageState.responseBody,
      });
      await logJanitorPageEvent(
        tabId,
        persisted?.captured ? "capture:persisted" : "capture:persist-failed",
        {
          resourceType: pageContext.type,
          resourceId: pageContext.id,
          source: "react-state",
          reason: persisted?.error || null,
        },
      );
      return persisted;
    } catch {
      await logJanitorPageEvent(tabId, "capture:page-state-error", {
        resourceType: pageContext.type,
        resourceId: pageContext.id,
        reason: "page-state-helper-unavailable",
      });
      return null;
    }
  };

  const logJanitorPageEvent = async (tabId, event, details = {}) => {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: (payload) => {
          const logger = globalThis.CreatorCardJanitorPageState?.log;
          if (typeof logger === "function") {
            logger(payload.event, payload.details);
            return;
          }
          console.info(
            `[Creator Card Porter] ${payload.event}`,
            payload.details,
          );
        },
        args: [{ event, details }],
      });
    } catch {
      // Diagnostics must never interrupt capture.
    }
  };

  const requestFreshCapture = async () => {
    const platform = elements.platform.value;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const pageContext = pageContextFromUrl(tab?.url, platform);
    if (tab?.id == null || !pageContext) {
      return {
        captured: false,
        error:
          platform === "other"
            ? "Open a normal web-based character editor before using Other capture."
            : "Open a supported JanitorAI character or Scripts edit page first.",
      };
    }
    try {
      if (platform === "other") {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["capture/form-fields.js", "capture/generic-content.js"],
        });
        return await chrome.tabs.sendMessage(tab.id, {
          type: "CREATOR_CARD_GENERIC_CAPTURE_NOW",
        });
      }
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [
          "capture/form-fields.js",
          "capture/content.js",
        ],
      });
      await logJanitorPageEvent(tab.id, "capture:requested", {
        resourceType: pageContext.type,
        resourceId: pageContext.id,
      });
      const pageStateResult = await captureJanitorPageState(
        tab.id,
        pageContext,
      );
      if (pageStateResult?.captured) return pageStateResult;
      await logJanitorPageEvent(tab.id, "capture:fallback", {
        resourceType: pageContext.type,
        resourceId: pageContext.id,
        source: "serialized-page-or-form",
      });
      const fallbackResult = await chrome.tabs.sendMessage(tab.id, {
        type: "CREATOR_CARD_CAPTURE_NOW",
      });
      await logJanitorPageEvent(tab.id, "capture:fallback-result", {
        resourceType: pageContext.type,
        resourceId: pageContext.id,
        captured: Boolean(fallbackResult?.captured),
        reason: fallbackResult?.error || null,
      });
      return fallbackResult;
    } catch {
      if (platform === "janitorai" && tab?.id != null) {
        await logJanitorPageEvent(tab.id, "capture:failed", {
          resourceType: pageContext.type,
          resourceId: pageContext.id,
          reason: "capture-helper-unavailable",
        });
      }
      return {
        captured: false,
        error:
          "The capture helper could not read this tab. Keep the creator page open and try again.",
      };
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      return copied;
    }
  };

  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      elements.tabs.forEach((item) => {
        const active = item === tab;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", String(active));
      });
      elements.previewPanel.hidden = target !== "preview";
      elements.mappingPanel.hidden = target !== "mapping";
      elements.jsonPanel.hidden = target !== "json";
    });
  });

  const updatePlatformDisclosure = () => {
    elements.platformWarning.hidden = elements.platform.value !== "other";
  };

  elements.platform.addEventListener("change", async () => {
    await chrome.storage.local.set({
      [SELECTED_PLATFORM_KEY]: elements.platform.value,
    });
    updatePlatformDisclosure();
    setCaptureFeedback();
    await loadLatestCapture();
  });

  elements.captureCurrent.addEventListener("click", async () => {
    elements.captureCurrent.disabled = true;
    elements.captureCurrent.textContent = "Capturing...";
    setCaptureFeedback();
    setStatus("Capturing", "idle");
    const result = await requestFreshCapture();
    await new Promise((resolve) => window.setTimeout(resolve, 200));
    const found = await loadLatestCapture();
    if (result?.error) {
      if (!found) elements.emptyDescription.textContent = result.error;
      setCaptureFeedback(result.error);
      setStatus(found ? "Capture incomplete" : "Capture failed", "error");
    } else if (result?.warning) {
      setCaptureFeedback(result.warning);
      setStatus("Capture incomplete", "error");
    }
    elements.captureCurrent.disabled = false;
    elements.captureCurrent.textContent = "Capture current page";
  });

  elements.clearCaptures.addEventListener("click", async () => {
    const confirmed = window.confirm(
      "Clear all locally stored character and lorebook captures for every platform?",
    );
    if (!confirmed) return;
    await chrome.storage.local.remove(STORAGE_KEY);
    setCaptureFeedback();
    await loadLatestCapture();
  });

  elements.copy.addEventListener("click", async () => {
    if (!state.document) return;
    const copied = await copyToClipboard(JSON.stringify(state.document, null, 2));
    elements.copy.textContent = copied ? "Copied" : "Copy failed";
    window.setTimeout(() => {
      elements.copy.textContent = "Copy JSON";
    }, 900);
  });

  elements.download.addEventListener("click", () => {
    if (!state.document) return;
    const safeName = (state.document.form.basicInfo.name || "lorebook")
      .replace(/[^a-z0-9\u4e00-\u9fff_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70);
    const blob = new Blob([JSON.stringify(state.document, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `character-card-${safeName || "character"}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  elements.diagnostics.addEventListener("click", () => {
    if (!state.captures.length) return;
    const confirmed = window.confirm(
      "This diagnostic file contains the full captured character and lorebook request/response bodies. It never includes cookies or authorization headers. Download it only if you intend to share those creator fields for mapping review.",
    );
    if (!confirmed) return;
    const diagnostic = {
      schema: "creator-card-porter.capture-diagnostic",
      version: 2,
      exportedAt: new Date().toISOString(),
      captures: state.captures,
    };
    const blob = new Blob([JSON.stringify(diagnostic, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "creator-card-porter-capture-diagnostic.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  const initialize = async () => {
    await prepareStorage();
    const stored = await chrome.storage.local.get(SELECTED_PLATFORM_KEY);
    if (["janitorai", "other"].includes(stored[SELECTED_PLATFORM_KEY])) {
      elements.platform.value = stored[SELECTED_PLATFORM_KEY];
    }
    updatePlatformDisclosure();
    await loadLatestCapture();
  };

  void initialize();
})();
