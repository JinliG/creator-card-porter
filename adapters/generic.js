(() => {
  const isRecord = (value) =>
    typeof value === "object" && value !== null && !Array.isArray(value);
  const stringValue = (value) =>
    typeof value === "string" ? value.trim() : "";
  const firstString = (record, keys) => {
    for (const key of keys) {
      const value = stringValue(record?.[key]);
      if (value) return value;
    }
    return "";
  };
  const sourcePaths = (keys) =>
    keys.map((key) => `source.character.data.${key}`);
  const mappingEntry = (targetField, sourceFields, status, note) => ({
    targetField,
    sourceFields,
    status,
    note,
  });

  const htmlToText = (value) =>
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .split(/\n+/)
      .map((part) => part.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join(" ");

  const resolveCharacter = (capture) => {
    if (capture?.platform !== "other") return null;
    const direct = capture?.responseBody?.character;
    return isRecord(direct) ? direct : null;
  };

  const resolveTags = (character) => {
    const raw = character?.tags;
    const values = Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? raw.split(/[,;\n]/)
        : [];
    return [
      ...new Set(
        values
          .map((value) =>
            typeof value === "string"
              ? value.trim()
              : stringValue(value?.name || value?.label || value?.value),
          )
          .filter(Boolean),
      ),
    ];
  };

  const resolveImageUrl = (character) => {
    const raw = firstString(character, [
      "avatar",
      "avatarUrl",
      "imageUrl",
      "image",
    ]);
    return /^https?:\/\//i.test(raw) ? raw : "";
  };

  const combinePersona = (personality, exampleDialogs) => {
    if (!exampleDialogs) return personality;
    const block = `<example_dialogs>\n${exampleDialogs}\n</example_dialogs>`;
    return personality ? `${personality}\n\n${block}` : block;
  };

  const CONSUMED_KEYS = new Set([
    "_capturedFormFields",
    "name",
    "description",
    "personality",
    "scenario",
    "firstMessage",
    "exampleDialogs",
    "avatar",
    "avatarUrl",
    "imageUrl",
    "image",
    "tags",
  ]);

  const buildDocument = (capture) => {
    const character = resolveCharacter(capture);
    if (!character) {
      throw new Error("The generic capture does not contain a character form.");
    }

    const name = firstString(character, ["name"]);
    const description = firstString(character, ["description"]);
    const personality = firstString(character, ["personality"]);
    const scenario = firstString(character, ["scenario"]);
    const firstMessage = firstString(character, ["firstMessage"]);
    const exampleDialogs = firstString(character, ["exampleDialogs"]);
    const imageUrl = resolveImageUrl(character);
    const tags = resolveTags(character);
    const bio = htmlToText(description);
    const hook = bio.length > 280 ? `${bio.slice(0, 277).trimEnd()}...` : bio;
    const persona = combinePersona(personality, exampleDialogs);
    const capturedAt = capture.capturedAt || new Date().toISOString();
    const captureKind = capture.kind || "editor-form";

    const mappings = [
      mappingEntry("basicInfo.name", sourcePaths(["name"]), name ? "mapped" : "missing", "Recognized from a common character-name field."),
      mappingEntry("basicInfo.attributes", [], "missing", "Generic capture cannot infer platform-specific attributes."),
      mappingEntry("basicInfo.imageUrl", sourcePaths(["avatar", "avatarUrl", "imageUrl", "image"]), imageUrl ? "derived" : "missing", "Uses an absolute avatar or character image URL when visible."),
      mappingEntry("basicInfo.avatarUrl", sourcePaths(["avatar", "avatarUrl", "imageUrl", "image"]), imageUrl ? "derived" : "missing", "Reuses the captured character image as the initial avatar."),
      mappingEntry("basicInfo.hook", sourcePaths(["description"]), hook ? "derived" : "missing", "Uses the opening text of the recognized public description."),
      mappingEntry("basicInfo.tag", sourcePaths(["tags"]), tags.length ? "derived" : "missing", "Normalizes a common tags field into a string list."),
      mappingEntry("basicInfo.bio", sourcePaths(["description"]), bio ? "derived" : "missing", "Converts the recognized public description to plain text."),
      mappingEntry("basicInfo.creatorNote.title", [], "missing", "Generic capture has no reliable creator-note title equivalent."),
      mappingEntry("basicInfo.creatorNote.content", [], "missing", "Generic capture has no reliable creator-note content equivalent."),
      mappingEntry("characterSettings.persona", sourcePaths(["personality", "exampleDialogs"]), persona ? (exampleDialogs ? "derived" : "mapped") : "missing", "Uses the recognized persona or system-prompt field and appends example dialogs when available."),
      mappingEntry("characterSettings.memorySeed", sourcePaths(["scenario"]), scenario ? "mapped" : "missing", "Uses the recognized scenario or context field."),
      mappingEntry("characterSettings.prologue", [], "missing", "Generic capture has no reliable visual prologue equivalent."),
      mappingEntry("characterSettings.greeting", sourcePaths(["firstMessage"]), firstMessage ? "mapped" : "missing", "Uses the recognized greeting or first-message field."),
      mappingEntry("playbook", [], "missing", "Generic form capture does not infer Lorebook or Playbook structures."),
    ];

    const unmapped = Object.entries(character)
      .filter(([key]) => !CONSUMED_KEYS.has(key))
      .map(([key, value]) => ({
        sourceField: `source.character.data.${key}`,
        reason:
          "Preserved in source, but the generic adapter has no verified standard-template mapping for this field.",
        valueType: value === null ? "null" : Array.isArray(value) ? "array" : typeof value,
      }));

    return {
      schema: "creator-card-porter.character-form-source",
      version: 2,
      source: {
        platform: "other",
        capturedAt,
        captureKind,
        character: {
          resourceId: capture.resourceId || null,
          capturedAt,
          captureKind,
          data: { ...character },
        },
        scripts: [],
      },
      form: {
        basicInfo: {
          name,
          attributes: [],
          imageUrl,
          avatarUrl: imageUrl,
          hook,
          tag: tags,
          bio,
          creatorNote: { title: "", content: "" },
        },
        characterSettings: {
          persona,
          memorySeed: scenario,
          prologue: "",
          greeting: firstMessage,
        },
        playbook: [],
      },
      mapping: mappings,
      unmapped,
    };
  };

  globalThis.CreatorCardGenericAdapter = {
    id: "other",
    label: "Other (experimental)",
    buildDocument,
    resolveCharacter,
    resolveScript: () => null,
  };
})();
