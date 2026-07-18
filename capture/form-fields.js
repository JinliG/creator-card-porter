(() => {
  if (globalThis.CreatorCardFormCapture) return;

  const normalizeIdentity = (value) =>
    typeof value === "string"
      ? value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")
      : "";

  const DEFINITIONS = [
    {
      key: "name",
      aliases: [
        "name",
        "charactername",
        "charname",
        "chname",
        "chatname",
        "botname",
        "名称",
        "名字",
        "角色名",
        "角色名称",
      ],
      excludes: ["username", "creatorname", "displayname", "search"],
    },
    {
      key: "description",
      aliases: [
        "description",
        "characterdescription",
        "characterbio",
        "publicdescription",
        "bio",
        "biography",
        "简介",
        "描述",
        "角色描述",
        "角色简介",
      ],
    },
    {
      key: "personality",
      aliases: [
        "personality",
        "characterpersonality",
        "persona",
        "definition",
        "characterdefinition",
        "systemprompt",
        "characterprompt",
        "人设",
        "性格",
        "角色设定",
        "角色定义",
      ],
    },
    {
      key: "scenario",
      aliases: [
        "scenario",
        "characterscenario",
        "startingcontext",
        "worldscenario",
        "context",
        "场景",
        "背景",
        "情景",
        "角色背景",
      ],
    },
    {
      key: "firstMessage",
      aliases: [
        "firstmessage",
        "initialmessage",
        "openingmessage",
        "greeting",
        "firstmes",
        "initialchat",
        "开场白",
        "初始消息",
        "第一条消息",
        "欢迎语",
        "开场消息",
      ],
    },
    {
      key: "exampleDialogs",
      aliases: [
        "exampledialogs",
        "exampledialogues",
        "examplemessages",
        "mesexample",
        "sampledialogue",
        "示例对话",
        "对话示例",
        "示例消息",
      ],
    },
    {
      key: "avatar",
      aliases: [
        "avatar",
        "avatarurl",
        "imageurl",
        "characterimage",
        "profileimage",
        "头像",
        "角色头像",
      ],
    },
    {
      key: "tags",
      aliases: ["tags", "tagids", "charactertags", "标签", "角色标签"],
    },
    {
      key: "scriptId",
      aliases: ["scriptid", "lorebookid"],
    },
  ];

  const identityParts = (field) => ({
    strong: [field?.name, field?.id, field?.dataTestId]
      .map(normalizeIdentity)
      .filter(Boolean),
    descriptive: [field?.label, field?.ariaLabel, field?.placeholder]
      .map(normalizeIdentity)
      .filter(Boolean),
  });

  const matchesDefinition = (definition, field) => {
    const { strong, descriptive } = identityParts(field);
    const identities = [...strong, ...descriptive];
    if (
      definition.excludes?.some((excluded) =>
        identities.some((identity) => identity.includes(excluded)),
      )
    ) {
      return false;
    }
    if (
      strong.some((identity) =>
        definition.aliases.some(
          (alias) => identity === alias || identity.endsWith(alias),
        ),
      )
    ) {
      return true;
    }
    return descriptive.some((identity) =>
      definition.aliases.some(
        (alias) => identity === alias || identity.startsWith(alias),
      ),
    );
  };

  const canonicalField = (field) =>
    DEFINITIONS.find((definition) => matchesDefinition(definition, field))
      ?.key || "";

  const hasValue = (value) => {
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined;
  };

  const assignValue = (target, key, value) => {
    if (!key || value === null || value === undefined) return;
    if (!(key in target)) {
      target[key] = value;
      return;
    }
    if (JSON.stringify(target[key]) === JSON.stringify(value)) return;
    target[key] = Array.isArray(target[key])
      ? [...target[key], value]
      : [target[key], value];
  };

  const rawFieldKey = (field) => {
    for (const value of [field?.name, field?.id, field?.dataTestId]) {
      if (
        typeof value === "string" &&
        /^[a-z][a-z0-9_.:-]{0,99}$/i.test(value)
      ) {
        return value;
      }
    }
    return "";
  };

  const buildCharacterFromFields = (fields) => {
    const safeFields = Array.isArray(fields)
      ? fields.filter((field) => field && typeof field === "object")
      : [];
    const character = {
      _capturedFormFields: safeFields.map((field) => ({ ...field })),
    };

    safeFields.forEach((field) => {
      assignValue(character, rawFieldKey(field), field.value);
      assignValue(character, canonicalField(field), field.value);
    });
    return character;
  };

  const characterScore = (character) => {
    if (!character || typeof character !== "object") return 0;
    const keys = [
      "description",
      "personality",
      "scenario",
      "firstMessage",
      "exampleDialogs",
      "avatar",
      "tags",
    ];
    return (
      (hasValue(character.name) ? 3 : 0) +
      keys.reduce(
        (score, key) => score + (hasValue(character[key]) ? 1 : 0),
        0,
      )
    );
  };

  const controlLabel = (control) => {
    const explicitLabel = Array.from(control.labels || [])
      .map((label) => label.textContent?.trim())
      .find(Boolean);
    if (explicitLabel) return explicitLabel;
    return control.closest("label")?.textContent?.trim() || "";
  };

  const controlValue = (control) => {
    const tagName = control.tagName.toLowerCase();
    const type = String(control.getAttribute("type") || "").toLowerCase();
    if (type === "checkbox") return Boolean(control.checked);
    if (type === "radio") return control.checked ? control.value : null;
    if (tagName === "select" && control.multiple) {
      return Array.from(control.selectedOptions).map((option) => option.value);
    }
    if (control.isContentEditable) return control.textContent || "";
    return "value" in control ? control.value : control.textContent || "";
  };

  const controlDescriptor = (control, index) => {
    const tagName = control.tagName.toLowerCase();
    return {
      index,
      name: control.getAttribute("name") || "",
      id: control.id || "",
      dataTestId: control.getAttribute("data-testid") || "",
      label: controlLabel(control),
      ariaLabel: control.getAttribute("aria-label") || "",
      placeholder: control.getAttribute("placeholder") || "",
      type:
        control.getAttribute("type") ||
        (control.isContentEditable ? "contenteditable" : tagName),
      value: controlValue(control),
    };
  };

  const editorControls = (root) =>
    Array.from(
      root.querySelectorAll(
        'input, textarea, select, [contenteditable="true"]',
      ),
    )
      .filter((control) => {
        const type = String(control.getAttribute("type") || "").toLowerCase();
        const identity = [
          control.getAttribute("name"),
          control.id,
          control.getAttribute("role"),
          control.getAttribute("aria-label"),
          control.getAttribute("placeholder"),
          control.getAttribute("data-testid"),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const excludedType = [
          "button",
          "file",
          "hidden",
          "image",
          "password",
          "reset",
          "search",
          "submit",
        ].includes(type);
        const searchControl =
          identity.includes("searchbox") ||
          identity.includes("search for characters") ||
          identity.includes("search for creators");
        return !excludedType && !searchControl;
      })
      .map(controlDescriptor);

  const collectCharacterEditorFields = (documentValue, minimumScore = 4) => {
    if (!documentValue?.querySelectorAll) return [];
    const roots = Array.from(documentValue.querySelectorAll("form"));
    const main = documentValue.querySelector("main");
    if (main) roots.push(main);
    if (!roots.length && documentValue.body) roots.push(documentValue.body);

    let bestFields = [];
    let bestScore = 0;
    roots.forEach((root) => {
      const fields = editorControls(root);
      const score = characterScore(buildCharacterFromFields(fields));
      if (
        score > bestScore ||
        (score === bestScore && fields.length > bestFields.length)
      ) {
        bestFields = fields;
        bestScore = score;
      }
    });
    return bestScore >= minimumScore ? bestFields : [];
  };

  globalThis.CreatorCardFormCapture = {
    buildCharacterFromFields,
    canonicalField,
    characterScore,
    collectCharacterEditorFields,
  };
})();
