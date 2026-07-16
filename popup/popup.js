(() => {
  const STORAGE_KEY = "creatorCardPorterCaptures";
  const state = { document: null, captures: [] };

  const elements = {
    captureStatus: document.querySelector("#capture-status"),
    emptyState: document.querySelector("#empty-state"),
    emptyTitle: document.querySelector("#empty-title"),
    emptyDescription: document.querySelector("#empty-description"),
    result: document.querySelector("#result"),
    characterName: document.querySelector("#character-name"),
    mappingList: document.querySelector("#mapping-list"),
    unmappedNote: document.querySelector("#unmapped-note"),
    jsonOutput: document.querySelector("#json-output"),
    previewPanel: document.querySelector("#preview-panel"),
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

  const pageContextFromUrl = (rawUrl) => {
    try {
      const url = new URL(rawUrl);
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
    elements.characterName.textContent = characterName
      ? `${characterName}${playbookCount ? ` · ${playbookCount} Playbook` : ""}`
      : `Lorebook only · ${playbookCount} entries`;
    elements.jsonOutput.textContent = JSON.stringify(documentValue, null, 2);
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
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const captures = Array.isArray(stored[STORAGE_KEY])
      ? stored[STORAGE_KEY]
      : [];
    const adapter = globalThis.CreatorCardPorterJanitorAdapter;
    const characterCapture = captures.find((capture) =>
      Boolean(adapter.resolveCharacter(capture)),
    );
    const scriptCaptures = captures.filter((capture) =>
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
      title: "No character or lorebook captured yet",
      description:
        "Open a JanitorAI character or Scripts edit page, then use Capture current page.",
      captures,
      status: captures.length ? "Incomplete" : "Waiting",
    });
    return false;
  };

  const requestFreshCapture = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id == null || !pageContextFromUrl(tab.url)) {
      return {
        captured: false,
        error: "Open a supported JanitorAI character or Scripts edit page first.",
      };
    }
    let result;
    try {
      result = await chrome.tabs.sendMessage(tab.id, {
        type: "CREATOR_CARD_PORTER_CAPTURE_NOW",
      });
    } catch {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["capture/page-bridge.js"],
          world: "MAIN",
        });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["capture/content.js"],
        });
        result = await chrome.tabs.sendMessage(tab.id, {
          type: "CREATOR_CARD_PORTER_CAPTURE_NOW",
        });
      } catch {
        return {
          captured: false,
          error: "The capture helper could not run on this tab.",
        };
      }
    }
    if (result?.reloadRequired) {
      await chrome.tabs.reload(tab.id);
      return { captured: false, error: null, reloading: true };
    }
    return result;
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
      elements.jsonPanel.hidden = target !== "json";
    });
  });

  elements.captureCurrent.addEventListener("click", async () => {
    elements.captureCurrent.disabled = true;
    elements.captureCurrent.textContent = "Capturing...";
    setStatus("Capturing", "idle");
    const result = await requestFreshCapture();
    if (result?.reloading) {
      setStatus("Reloading page", "idle");
      elements.captureCurrent.disabled = false;
      elements.captureCurrent.textContent = "Capture current page";
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 200));
    const found = await loadLatestCapture();
    if (result?.error) {
      if (!found) elements.emptyDescription.textContent = result.error;
      setStatus("Capture failed", "error");
    }
    elements.captureCurrent.disabled = false;
    elements.captureCurrent.textContent = "Capture current page";
  });

  elements.clearCaptures.addEventListener("click", async () => {
    const confirmed = window.confirm(
      "Clear all locally stored JanitorAI character and lorebook captures?",
    );
    if (!confirmed) return;
    await chrome.storage.local.remove(STORAGE_KEY);
    await loadLatestCapture();
  });

  elements.copy.addEventListener("click", async () => {
    if (!state.document) return;
    await navigator.clipboard.writeText(JSON.stringify(state.document, null, 2));
    elements.copy.textContent = "Copied";
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
    anchor.download = `creator-card-porter-${safeName || "character"}.json`;
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
      schema: "creator-card-porter.character-capture-diagnostic",
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
    anchor.download = "creator-card-porter-janitorai-capture-diagnostic.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  void loadLatestCapture();
})();
