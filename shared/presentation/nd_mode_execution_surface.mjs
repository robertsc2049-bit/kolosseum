function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function toNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function tokenizeVisibleName(name) {
  const trimmed = toNonEmptyString(name);
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/u).filter(Boolean).length;
}

function selectVisibleName(item, ndMode) {
  const ndLabel =
    toNonEmptyString(item?.presentation?.nd_label) ??
    toNonEmptyString(item?.nd_label);

  const defaultLabel =
    toNonEmptyString(item?.display_name) ??
    toNonEmptyString(item?.name) ??
    toNonEmptyString(item?.exercise_id) ??
    "Unnamed Exercise";

  if (ndMode && ndLabel) {
    return ndLabel;
  }

  return defaultLabel;
}

function normalizeInstructionLines(item, ndMode, instructionDensity) {
  const shortInstruction =
    toNonEmptyString(item?.instruction?.short) ??
    toNonEmptyString(item?.instruction_short);

  const detailed =
    Array.isArray(item?.instruction?.detailed)
      ? item.instruction.detailed
          .map((line) => toNonEmptyString(line))
          .filter(Boolean)
      : [];

  if (!shortInstruction) {
    return [];
  }

  if (ndMode) {
    return [shortInstruction];
  }

  if (instructionDensity === "minimal") {
    return [shortInstruction];
  }

  if (instructionDensity === "standard") {
    return [shortInstruction, ...detailed.slice(0, 1)];
  }

  return [shortInstruction, ...detailed];
}

function normalizeChoice(choice, index) {
  const choiceId =
    toNonEmptyString(choice?.choice_id) ??
    toNonEmptyString(choice?.option_id) ??
    `choice_${index + 1}`;

  const label =
    toNonEmptyString(choice?.label) ??
    toNonEmptyString(choice?.display_name) ??
    choiceId;

  return {
    choice_id: choiceId,
    label,
    preferred: choice?.preferred === true
  };
}

function normalizeVisibleChoices(item, ndMode) {
  const allChoices = Array.isArray(item?.choices)
    ? item.choices.map((choice, index) => normalizeChoice(choice, index))
    : [];

  if (!ndMode || allChoices.length <= 1) {
    return {
      visible_choices: allChoices,
      hidden_choice_count: 0,
      expansion_available: false
    };
  }

  const preferredChoice =
    allChoices.find((choice) => choice.preferred) ??
    allChoices[0];

  return {
    visible_choices: [preferredChoice],
    hidden_choice_count: Math.max(0, allChoices.length - 1),
    expansion_available: true
  };
}

function normalizeWorkItem(item, options) {
  const ndMode = options.nd_mode === true;
  const instructionDensity = options.instruction_density ?? "standard";

  const { visible_choices, hidden_choice_count, expansion_available } =
    normalizeVisibleChoices(item, ndMode);

  const visible_name = selectVisibleName(item, ndMode);
  const visible_instruction_lines = normalizeInstructionLines(
    item,
    ndMode,
    instructionDensity
  );

  return {
    work_item_id:
      toNonEmptyString(item?.work_item_id) ??
      toNonEmptyString(item?.id) ??
      toNonEmptyString(item?.exercise_id) ??
      "unknown_work_item",
    exercise_id:
      toNonEmptyString(item?.exercise_id) ??
      "unknown_exercise",
    visible_name,
    visible_instruction_lines,
    visible_choices,
    hidden_choice_count,
    expansion_available
  };
}

export function createTruthSignature(session) {
  const workItems = Array.isArray(session?.work_items) ? session.work_items : [];

  return {
    session_id:
      toNonEmptyString(session?.session_id) ??
      "unknown_session",
    work_items: workItems.map((item) => ({
      work_item_id:
        toNonEmptyString(item?.work_item_id) ??
        toNonEmptyString(item?.id) ??
        toNonEmptyString(item?.exercise_id) ??
        "unknown_work_item",
      exercise_id:
        toNonEmptyString(item?.exercise_id) ??
        "unknown_exercise",
      choice_ids: Array.isArray(item?.choices)
        ? item.choices.map((choice, index) => normalizeChoice(choice, index).choice_id)
        : []
    }))
  };
}

export function normalizeNdExecutionSurface(session, options = {}) {
  const input = cloneJson(session ?? {});
  const workItems = Array.isArray(input?.work_items) ? input.work_items : [];

  const normalized = {
    session_id:
      toNonEmptyString(input?.session_id) ??
      "unknown_session",
    nd_mode: options.nd_mode === true,
    instruction_density: options.instruction_density ?? "standard",
    truth_signature: createTruthSignature(input),
    work_items: workItems.map((item) => normalizeWorkItem(item, options))
  };

  return normalized;
}

export function computePresentationComplexity(surface) {
  const workItems = Array.isArray(surface?.work_items) ? surface.work_items : [];

  let total_name_tokens = 0;
  let total_instruction_lines = 0;
  let total_visible_choices = 0;
  let max_choices_per_step = 0;

  for (const item of workItems) {
    const nameTokenCount = tokenizeVisibleName(item?.visible_name);
    const instructionCount = Array.isArray(item?.visible_instruction_lines)
      ? item.visible_instruction_lines.length
      : 0;
    const choiceCount = Array.isArray(item?.visible_choices)
      ? item.visible_choices.length
      : 0;

    total_name_tokens += nameTokenCount;
    total_instruction_lines += instructionCount;
    total_visible_choices += choiceCount;
    max_choices_per_step = Math.max(max_choices_per_step, choiceCount);
  }

  return {
    total_name_tokens,
    total_instruction_lines,
    total_visible_choices,
    max_choices_per_step
  };
}