(() => {
  if (window.__creatorCardPorterCaptureBridgeInstalled) return;
  window.__creatorCardPorterCaptureBridgeInstalled = true;

  const MESSAGE_TYPE = "CREATOR_CARD_PORTER_CAPTURE";
  const ALLOWED_HOSTS = new Set([
    "janitorai.com",
    "www.janitorai.com",
    "jannyai.com",
    "www.jannyai.com",
  ]);

  const resourceTypeForRequest = (rawUrl) => {
    try {
      const url = new URL(rawUrl, window.location.href);
      if (!ALLOWED_HOSTS.has(url.hostname)) return null;
      if (
        /\/hampter\/characters(?:\/|$)/.test(url.pathname) ||
        /\/api\/characters(?:\/|$)/.test(url.pathname)
      ) {
        return "character";
      }
      if (
        /\/hampter\/script\/[a-f0-9-]{36}(?:\/|$)/i.test(url.pathname) ||
        /\/api\/scripts?(?:\/|$)/i.test(url.pathname)
      ) {
        return "script";
      }
      return null;
    } catch {
      return null;
    }
  };

  const parseJsonText = (value) => {
    if (typeof value !== "string") return value ?? null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  };

  const emitCapture = ({ url, method, requestBody, responseBody }) => {
    const resourceType = resourceTypeForRequest(url);
    if (!resourceType) return;
    window.postMessage(
      {
        type: MESSAGE_TYPE,
        capture: {
          platform: "janitorai",
          kind: "network",
          resourceType,
          url: new URL(url, window.location.href).href,
          method: String(method || "GET").toUpperCase(),
          requestBody: requestBody ?? null,
          responseBody: responseBody ?? null,
          sourcePageUrl: window.location.href,
          capturedAt: new Date().toISOString(),
        },
      },
      window.location.origin,
    );
  };

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function cardPorterCaptureFetch(input, init) {
    const url =
      typeof input === "string" || input instanceof URL ? input : input?.url;
    const method = init?.method || input?.method || "GET";
    const shouldCapture = Boolean(resourceTypeForRequest(url));
    let requestBodyPromise = Promise.resolve(parseJsonText(init?.body));

    if (
      shouldCapture &&
      init?.body == null &&
      typeof Request !== "undefined" &&
      input instanceof Request &&
      method.toUpperCase() !== "GET"
    ) {
      requestBodyPromise = input
        .clone()
        .text()
        .then(parseJsonText)
        .catch(() => null);
    }

    const responsePromise = nativeFetch(input, init);
    if (shouldCapture) {
      void responsePromise
        .then((response) => {
          void Promise.all([
            requestBodyPromise,
            response
              .clone()
              .text()
              .then(parseJsonText)
              .catch(() => null),
          ]).then(([requestBody, responseBody]) => {
            emitCapture({ url, method, requestBody, responseBody });
          });
        })
        .catch(() => {
          // Preserve the page's fetch rejection without creating a second one.
        });
    }
    return responsePromise;
  };

  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function cardPorterCaptureOpen(method, url) {
    this.__cardPorterCapture = {
      method: String(method || "GET").toUpperCase(),
      url: new URL(String(url), window.location.href).href,
    };
    return nativeOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function cardPorterCaptureSend(body) {
    const meta = this.__cardPorterCapture;
    if (meta && resourceTypeForRequest(meta.url)) {
      const requestBody = parseJsonText(body);
      this.addEventListener(
        "loadend",
        () => {
          let responseBody = null;
          if (this.responseType === "json") {
            responseBody = this.response;
          } else if (!this.responseType || this.responseType === "text") {
            responseBody = parseJsonText(this.responseText);
          }
          emitCapture({ ...meta, requestBody, responseBody });
        },
        { once: true },
      );
    }
    return nativeSend.apply(this, arguments);
  };
})();
