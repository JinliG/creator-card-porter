(() => {
  const IMAGE_BASE_URL = "https://image.jannyai.com/bot-avatars/";
  const TAG_MAP = {
    1: "Male",
    2: "Female",
    3: "Non-binary",
    4: "Celebrity",
    5: "OC",
    6: "Fictional",
    7: "Real",
    8: "Game",
    9: "Anime",
    10: "Historical",
    11: "Royalty",
    12: "Detective",
    13: "Hero",
    14: "Villain",
    15: "Magical",
    16: "Non-human",
    17: "Monster",
    18: "Monster Girl",
    19: "Alien",
    20: "Robot",
    21: "Politics",
    22: "Vampire",
    23: "Giant",
    24: "OpenAI",
    25: "Elf",
    26: "Multiple",
    27: "VTuber",
    28: "Dominant",
    29: "Submissive",
    30: "Scenario",
    31: "Pokemon",
    32: "Assistant",
    34: "Non-English",
    36: "Philosophy",
    38: "RPG",
    39: "Religion",
    41: "Books",
    42: "AnyPOV",
    43: "Angst",
    44: "Demi-Human",
    45: "Enemies to Lovers",
    46: "Smut",
    47: "MLM",
    48: "WLW",
    49: "Action",
    50: "Romance",
    51: "Horror",
    52: "Slice of Life",
    53: "Fantasy",
    54: "Drama",
    55: "Comedy",
    56: "Mystery",
    57: "Sci-Fi",
    59: "Yandere",
    60: "Furry",
    61: "Movies/TV",
  };

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

  const candidateScore = (record) => {
    if (!isRecord(record)) return 0;
    const keys = [
      "name",
      "personality",
      "scenario",
      "firstMessage",
      "first_message",
      "exampleDialogs",
      "example_dialogs",
      "description",
      "avatar",
    ];
    return keys.reduce(
      (score, key) => score + (record[key] == null ? 0 : key === "name" ? 3 : 1),
      0,
    );
  };

  const findBestCharacter = (root) => {
    let best = null;
    let bestScore = 0;
    const seen = new Set();

    const visit = (value, depth) => {
      if (depth > 5 || value == null || seen.has(value)) return;
      if (isRecord(value)) {
        seen.add(value);
        const score = candidateScore(value);
        if (score > bestScore) {
          best = value;
          bestScore = score;
        }
        Object.values(value).forEach((nested) => visit(nested, depth + 1));
      } else if (Array.isArray(value)) {
        value.slice(0, 20).forEach((nested) => visit(nested, depth + 1));
      }
    };

    visit(root, 0);
    return bestScore >= 4 ? best : null;
  };

  const resolveCharacter = (capture) => {
    const response = findBestCharacter(capture?.responseBody);
    const request = findBestCharacter(capture?.requestBody);
    if (!response && !request) return null;
    return { ...(response || {}), ...(request || {}) };
  };

  const resolveTags = (character) => {
    if (!character) return [];
    const tags = Array.isArray(character.tags)
      ? character.tags
          .map((tag) =>
            typeof tag === "string"
              ? tag.trim()
              : stringValue(tag?.name || tag?.label),
          )
          .filter(Boolean)
      : [];
    const tagIds = Array.isArray(character.tagIds)
      ? character.tagIds
      : Array.isArray(character.tag_ids)
        ? character.tag_ids
        : [];
    const names = tagIds
      .map((id) => TAG_MAP[Number(id)])
      .filter(Boolean);
    return [...new Set([...tags, ...names])];
  };

  const decodeHtmlEntities = (value) =>
    value.replace(
      /&(#(?:x[0-9a-f]+|\d+)|amp|lt|gt|quot|apos|nbsp);/gi,
      (entity, code) => {
        const named = {
          amp: "&",
          lt: "<",
          gt: ">",
          quot: '"',
          apos: "'",
          nbsp: " ",
        };
        if (!String(code).startsWith("#")) {
          return named[String(code).toLowerCase()] || entity;
        }
        const numeric = String(code).slice(1);
        const point = numeric.toLowerCase().startsWith("x")
          ? Number.parseInt(numeric.slice(1), 16)
          : Number.parseInt(numeric, 10);
        return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
      },
    );

  const htmlToPlainText = (value) =>
    decodeHtmlEntities(
      value
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(?:p|div|li|h[1-6])>/gi, "\n")
        .replace(/<[^>]+>/g, ""),
    )
      .split(/\n+/)
      .map((part) => part.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join(" ");

  const deriveHook = (description) => {
    const plainText = htmlToPlainText(description);
    if (!plainText) return "";
    if (plainText.length <= 280) return plainText;
    return `${plainText.slice(0, 277).trimEnd()}...`;
  };

  const resolveImageUrl = (value) => {
    const raw = stringValue(value);
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("//")) return `https:${raw}`;
    const filename = raw
      .replace(/^\/+/, "")
      .replace(/^bot-avatars\//i, "");
    return filename ? `${IMAGE_BASE_URL}${filename}` : "";
  };

  const combinePersona = (personality, exampleDialogs) => {
    if (!exampleDialogs) return personality;
    const exampleBlock = `<example_dialogs>\n${exampleDialogs}\n</example_dialogs>`;
    return personality ? `${personality}\n\n${exampleBlock}` : exampleBlock;
  };

  const mappingEntry = (targetField, sourceFields, status, note) => ({
    targetField,
    sourceFields,
    status,
    note,
  });

  const scriptCandidateScore = (record) => {
    if (!isRecord(record)) return 0;
    return (
      (typeof record.script === "string" || Array.isArray(record.script) ? 6 : 0) +
      (record.type === "lorebook" ? 3 : 0) +
      (typeof record.title === "string" ? 1 : 0) +
      (typeof record.id === "string" ? 1 : 0)
    );
  };

  const findBestScript = (root) => {
    let best = null;
    let bestScore = 0;
    const seen = new Set();

    const visit = (value, depth) => {
      if (depth > 5 || value == null || seen.has(value)) return;
      if (isRecord(value)) {
        seen.add(value);
        const score = scriptCandidateScore(value);
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

  const scriptIdFromUrl = (rawUrl) => {
    try {
      const path = new URL(rawUrl, "https://janitorai.com").pathname;
      return (
        path.match(/\/hampter\/script\/([a-f0-9-]{36})(?:\/|$)/i)?.[1] ||
        path.match(/\/scripts\/([a-f0-9-]{36})\/edit(?:\/|$)/i)?.[1] ||
        ""
      );
    } catch {
      return "";
    }
  };

  const resolveScript = (capture) => {
    const response = findBestScript(capture?.responseBody);
    const request = findBestScript(capture?.requestBody);
    if (!response && !request) return null;
    const merged = { ...(response || {}), ...(request || {}) };
    const id =
      firstString(merged, ["id", "scriptId", "script_id"]) ||
      scriptIdFromUrl(capture?.url || capture?.sourcePageUrl || "");
    return { ...merged, id };
  };

  const resolveCharacterScripts = (character) => {
    if (!character) return [];
    if (Array.isArray(character.scripts)) return character.scripts;
    if (isRecord(character.script)) return [character.script];
    return [];
  };

  const scriptIdFromReference = (reference) => {
    if (typeof reference === "string") {
      return scriptIdFromUrl(reference) || reference;
    }
    if (!isRecord(reference)) return "";
    return (
      firstString(reference, ["id", "scriptId", "script_id"]) ||
      scriptIdFromUrl(firstString(reference, ["api_path", "apiPath", "url"]))
    );
  };

  const referencedScriptIds = (character) => {
    const ids = resolveCharacterScripts(character)
      .map(scriptIdFromReference)
      .filter(Boolean);
    const single = firstString(character, ["scriptId", "script_id"]);
    if (single) ids.push(single);
    if (typeof character?.script === "string") {
      ids.push(scriptIdFromUrl(character.script) || character.script);
    }
    return new Set(ids);
  };

  const scriptEntries = (script) => {
    let parsed = script?.script;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return [];
      }
    }
    if (isRecord(parsed) && Array.isArray(parsed.entries)) {
      parsed = parsed.entries;
    }
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  };

  const entryKeywords = (entry) => {
    const value = entry.key ?? entry.keys ?? entry.keywords ?? entry.keysRaw;
    const values = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(/[,;\n]/)
        : [];
    return [...new Set(values.map(stringValue).filter(Boolean))];
  };

  const safeItemName = (value, fallback) => {
    const name = stringValue(value) || fallback;
    return name.length <= 20 ? name : `${name.slice(0, 17).trimEnd()}...`;
  };

  const safeTriggerCondition = (value) =>
    value.length <= 150 ? value : `${value.slice(0, 147).trimEnd()}...`;

  const buildPlaybook = (scripts) => {
    const items = [];
    let parsedEntries = 0;
    for (const script of scripts) {
      const title = firstString(script, ["title", "name"]) || "Lorebook";
      const id = firstString(script, ["id", "scriptId", "script_id"]);
      const entries = scriptEntries(script);
      parsedEntries += entries.length;
      for (let index = 0; index < entries.length && items.length < 30; index += 1) {
        const entry = entries[index];
        const body = firstString(entry, ["content", "body", "text"]);
        if (!body) continue;
        const name = safeItemName(
          firstString(entry, ["name", "title", "comment"]),
          `${title} ${index + 1}`,
        );
        const keywords = entryKeywords(entry);
        const alwaysActive =
          entry.constant === true ||
          entry.alwaysActive === true ||
          entry.always_active === true;
        const triggerCondition = safeTriggerCondition(
          alwaysActive
            ? ""
            : keywords.length
              ? `When the conversation mentions or relates to any of: ${keywords.join(", ")}.`
              : `When ${name} is relevant to the current scene or conversation.`,
        );
        items.push({
          id: `${id || "janitor-script"}:${entry.id ?? index}`,
          name,
          triggerType: alwaysActive ? "reminder" : "nl_trigger",
          triggerCondition,
          body,
          visibility: true,
          category: "Custom",
          enabled: entry.enabled !== false,
        });
      }
    }
    return { items, parsedEntries };
  };

  const selectScripts = (character, captures) => {
    const inline = resolveCharacterScripts(character).filter(
      (script) => scriptCandidateScore(script) >= 6,
    );
    const captured = captures.map(resolveScript).filter(Boolean);
    const byId = new Map();
    [...captured, ...inline].forEach((script) => {
      const key = scriptIdFromReference(script) || JSON.stringify(script.script);
      if (!byId.has(key)) byId.set(key, script);
    });
    return [...byId.values()];
  };

  const characterMappings = ({
    name,
    description,
    imageUrl,
    tags,
    persona,
    exampleDialogs,
    scenario,
    firstMessage,
  }) => [
    mappingEntry("basicInfo.name", ["name"], name ? "mapped" : "missing", "Direct field mapping."),
    mappingEntry("basicInfo.attributes", [], "missing", "the target platform attributes are platform-defined and must be selected after import."),
    mappingEntry("basicInfo.imageUrl", ["imageUrl", "avatar"], imageUrl ? "derived" : "missing", "Resolves relative filenames against the JanitorAI avatar CDN."),
    mappingEntry("basicInfo.avatarUrl", ["imageUrl", "avatar"], imageUrl ? "derived" : "missing", "Reuses the resolved source image as the initial square avatar."),
    mappingEntry("basicInfo.hook", ["description"], description ? "derived" : "missing", "Strips rich HTML from the public description and uses its opening text."),
    mappingEntry("basicInfo.tag", ["tags", "tagIds"], tags.length ? "mapped" : "missing", "Converts JanitorAI tag IDs to readable tag names."),
    mappingEntry("basicInfo.bio", ["description"], description ? "mapped" : "missing", "Maps the public character description to the the target platform bio."),
    mappingEntry("basicInfo.creatorNote.title", [], "missing", "JanitorAI has no equivalent the target platform creator-note title."),
    mappingEntry("basicInfo.creatorNote.content", [], "missing", "JanitorAI has no equivalent the target platform creator-note content."),
    mappingEntry("characterSettings.persona", ["personality", "exampleDialogs"], persona ? (exampleDialogs ? "derived" : "mapped") : "missing", exampleDialogs ? "Appends example dialogs inside an <example_dialogs> block." : "Maps the character definition to Persona."),
    mappingEntry("characterSettings.memorySeed", ["scenario"], scenario ? "mapped" : "missing", "Maps the starting situation to Memory Seed."),
    mappingEntry("characterSettings.prologue", [], "missing", "JanitorAI has no non-prompt visual prologue equivalent."),
    mappingEntry("characterSettings.greeting", ["firstMessage"], firstMessage ? "mapped" : "missing", "Maps the first message to Greeting."),
  ];

  const buildDocument = (capture, scriptCaptures = []) => {
    const character = resolveCharacter(capture);
    const selectedScripts = selectScripts(character, scriptCaptures);
    const { items: playbook, parsedEntries } = buildPlaybook(selectedScripts);
    if (!character && !playbook.length) {
      throw new Error("The captures do not contain a character or lorebook definition.");
    }

    const name = firstString(character, ["name", "chat_name", "chatName"]);
    const description = firstString(character, [
      "description",
      "tagline",
      "bio",
    ]);
    const personality = firstString(character, [
      "personality",
      "persona",
      "definition",
    ]);
    const scenario = firstString(character, ["scenario"]);
    const firstMessage = firstString(character, [
      "firstMessage",
      "first_message",
      "initialMessage",
      "initial_message",
      "first_mes",
      "greeting",
    ]);
    const exampleDialogs = firstString(character, [
      "exampleDialogs",
      "example_dialogs",
      "mes_example",
    ]);
    const imageUrl = resolveImageUrl(
      firstString(character, [
        "imageUrl",
        "image_url",
        "avatarUrl",
        "avatar_url",
        "avatar",
        "image",
      ]) || firstString(capture?.responseBody, ["imageUrl", "image_url"]),
    );
    const tags = resolveTags(character);
    const hook = deriveHook(description);
    const persona = combinePersona(personality, exampleDialogs);
    const characterId = firstString(character, [
      "id",
      "characterId",
      "character_id",
    ]);
    const references = referencedScriptIds(character);
    const mappings = character
      ? characterMappings({
          name,
          description,
          imageUrl,
          tags,
          persona,
          exampleDialogs,
          scenario,
          firstMessage,
        })
      : [];
    mappings.push(
      mappingEntry(
        "playbook",
        ["scripts[].script"],
        playbook.length ? "derived" : "missing",
        playbook.length
          ? "Converts JanitorAI lorebook entries into the target platform Playbook items; keywords become natural-language trigger conditions and constant entries become Always On reminders."
          : "Open the linked JanitorAI Scripts edit page and reload it once to capture its lorebook entries.",
      ),
    );

    const primaryCapture = character ? capture : scriptCaptures[0] || capture;
    const unmapped = [];
    const selectedScriptIds = new Set(
      selectedScripts.map(scriptIdFromReference).filter(Boolean),
    );
    const missingReferenceCount = character
      ? [...references].filter((id) => !selectedScriptIds.has(id)).length
      : 0;
    if (missingReferenceCount > 0) {
      unmapped.push({
        sourceField: "scripts",
        reason: `${missingReferenceCount} linked JanitorAI script(s) have not been captured yet. Open each Scripts edit page and capture it once.`,
        valueType: "array",
      });
    }
    if (parsedEntries > playbook.length) {
      unmapped.push({
        sourceField: "scripts[].script",
        reason: `${parsedEntries - playbook.length} lorebook entries were skipped because they were empty or exceeded the target platform's 30-item Playbook limit.`,
        valueType: "array",
      });
    }

    return {
      schema: "creator-card-porter.character-form-source",
      version: 1,
      source: {
        platform: "janitorai",
        characterId: characterId || null,
        characterUrl: primaryCapture?.sourcePageUrl || primaryCapture?.url || null,
        capturedAt: primaryCapture?.capturedAt || new Date().toISOString(),
        captureKind: character
          ? selectedScripts.length
            ? `${capture.kind || "network"}+script`
            : capture.kind || "network"
          : `script-${primaryCapture?.kind || "network"}`,
        requestUrl: primaryCapture?.url || null,
        requestMethod: primaryCapture?.method || null,
      },
      form: {
        basicInfo: {
          name,
          attributes: [],
          imageUrl,
          avatarUrl: imageUrl,
          hook,
          tag: tags,
          bio: description,
          creatorNote: { title: "", content: "" },
        },
        characterSettings: {
          persona,
          memorySeed: scenario,
          prologue: "",
          greeting: firstMessage,
        },
        playbook,
      },
      mapping: mappings,
      unmapped,
    };
  };

  globalThis.CreatorCardPorterJanitorAdapter = {
    id: "janitorai",
    label: "JanitorAI",
    buildDocument,
    findBestCharacter,
    findBestScript,
    resolveCharacter,
    resolveScript,
  };
})();
