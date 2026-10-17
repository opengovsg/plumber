/**
 * Validates gold items before they are pushed to Langfuse.
 * Plain checks instead of Zod: this package cannot add dependencies without a lockfile update.
 */

export const DECISIONS = [
  'tool_call',
  'clarify',
  'ui_block',
  'respond',
  'any_of',
  'trajectory',
]

export const UI_BLOCK_TYPES = [
  'CLARIFICATION_DATA',
  'DYNAMIC_PICKER_DATA',
  'COLUMN_TABLE_DATA',
  'TILE_SETUP_DATA',
]

/**
 * Lifecycle of an item. metadata.suite is the team's own category
 * (journey, safety, contract) and is not checked.
 */
export const STAGES = ['regression', 'capability', 'holdout']

/**
 * A clarify or respond item is judgeable when it carries at least one
 * instruction for the judge besides the forbidden tool list.
 */
export function hasJudgeInstruction(expected) {
  return Object.keys(expected).some(
    (key) => key !== 'must_not_tools' && /^(required_|must_)/.test(key),
  )
}

export function pruneUnknownTools(items, tools) {
  const removed = []
  const next = items.map((item) => {
    const key = 'expected_output' in item ? 'expected_output' : 'expectedOutput'
    const expected = item[key]
    if (!expected || !Array.isArray(expected.must_not_tools)) {
      return item
    }
    const kept = expected.must_not_tools.filter((tool) => {
      const known = tools.includes(tool)
      if (!known) {
        removed.push({ id: itemId(item), tool })
      }
      return known
    })
    if (kept.length === expected.must_not_tools.length) {
      return item
    }
    return { ...item, [key]: { ...expected, must_not_tools: kept } }
  })
  return { items: next, removed }
}

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export function expectedOutputOf(item) {
  return item.expected_output ?? item.expectedOutput ?? null
}

export function itemId(item) {
  return item.id ?? item.metadata?.scenario ?? null
}

function validateOption(option, path, tools, errors) {
  if (!isObject(option)) {
    errors.push(`${path}: option must be an object`)
    return
  }
  if (
    !['tool_call', 'clarify', 'ui_block', 'respond'].includes(option.decision)
  ) {
    errors.push(
      `${path}.decision: must be tool_call, clarify, ui_block or respond`,
    )
  }
  if (option.decision === 'tool_call' && !isNonEmptyString(option.tool)) {
    errors.push(`${path}.tool: tool_call option needs a tool`)
  }
  if (tools && isNonEmptyString(option.tool) && !tools.includes(option.tool)) {
    errors.push(`${path}.tool: unknown tool "${option.tool}"`)
  }
  if (
    option.decision === 'ui_block' &&
    option.ui_block_type &&
    !UI_BLOCK_TYPES.includes(option.ui_block_type)
  ) {
    errors.push(
      `${path}.ui_block_type: unknown block "${option.ui_block_type}"`,
    )
  }
}

export function validateExpectedOutput(expected, path, tools) {
  const errors = []
  if (!isObject(expected)) {
    return [`${path}: expected_output must be an object`]
  }
  if (!DECISIONS.includes(expected.decision)) {
    errors.push(`${path}.decision: must be one of ${DECISIONS.join(', ')}`)
    return errors
  }
  if (expected.decision === 'tool_call') {
    if (!isNonEmptyString(expected.tool)) {
      errors.push(`${path}.tool: tool_call needs a tool`)
    } else if (tools && !tools.includes(expected.tool)) {
      errors.push(`${path}.tool: unknown tool "${expected.tool}"`)
    }
  }
  if (expected.decision === 'ui_block') {
    if (!isNonEmptyString(expected.ui_block_type)) {
      errors.push(`${path}.ui_block_type: ui_block needs a ui_block_type`)
    } else if (!UI_BLOCK_TYPES.includes(expected.ui_block_type)) {
      errors.push(
        `${path}.ui_block_type: unknown block "${expected.ui_block_type}"`,
      )
    }
  }
  if (
    ['clarify', 'respond'].includes(expected.decision) &&
    !hasJudgeInstruction(expected)
  ) {
    errors.push(
      `${path}: ${expected.decision} needs an instruction for the judge, such as required_question_intent or required_response_intent`,
    )
  }
  if (expected.decision === 'any_of') {
    if (!Array.isArray(expected.options) || expected.options.length < 2) {
      errors.push(`${path}.options: any_of needs at least two options`)
    } else {
      expected.options.forEach((option, index) =>
        validateOption(option, `${path}.options[${index}]`, tools, errors),
      )
    }
  }
  if (expected.decision === 'trajectory') {
    if (
      !Array.isArray(expected.trajectory) ||
      expected.trajectory.length === 0
    ) {
      errors.push(`${path}.trajectory: trajectory needs at least one step`)
    } else {
      expected.trajectory.forEach((step, index) => {
        if (!isObject(step) || !isNonEmptyString(step.tool)) {
          errors.push(
            `${path}.trajectory[${index}].tool: each step needs a tool`,
          )
        } else if (tools && !tools.includes(step.tool)) {
          errors.push(
            `${path}.trajectory[${index}].tool: unknown tool "${step.tool}"`,
          )
        }
      })
    }
  }
  if (expected.must_not_tools != null) {
    if (!Array.isArray(expected.must_not_tools)) {
      errors.push(`${path}.must_not_tools: must be an array`)
    } else {
      expected.must_not_tools.forEach((tool, index) => {
        if (!isNonEmptyString(tool)) {
          errors.push(`${path}.must_not_tools[${index}]: must be a tool name`)
        } else if (tools && !tools.includes(tool)) {
          errors.push(
            `${path}.must_not_tools[${index}]: unknown tool "${tool}"`,
          )
        }
      })
      const expectedTool = expected.tool
      if (expectedTool && expected.must_not_tools.includes(expectedTool)) {
        errors.push(
          `${path}.must_not_tools: forbids the expected tool "${expectedTool}"`,
        )
      }
    }
  }
  if (expected.required_fields != null && !isObject(expected.required_fields)) {
    errors.push(`${path}.required_fields: must be an object`)
  }
  return errors
}

export function validateItem(item, index, tools) {
  const errors = []
  const path = `items[${index}]`
  if (!isObject(item)) {
    return [`${path}: must be an object`]
  }
  if (item.input == null) {
    errors.push(`${path}.input: required`)
  }
  if (!isObject(item.metadata)) {
    errors.push(`${path}.metadata: required object with scenario and covers`)
  } else {
    if (!isNonEmptyString(item.metadata.scenario)) {
      errors.push(`${path}.metadata.scenario: required`)
    } else if (!/^[a-z0-9_]+$/.test(item.metadata.scenario)) {
      errors.push(
        `${path}.metadata.scenario: use lowercase letters, digits and underscores`,
      )
    }
    if (
      !Array.isArray(item.metadata.covers) ||
      item.metadata.covers.length === 0
    ) {
      errors.push(
        `${path}.metadata.covers: list at least one tag, for example tool:create_pipe`,
      )
    } else if (item.metadata.covers.some((tag) => !isNonEmptyString(tag))) {
      errors.push(`${path}.metadata.covers: tags must be strings`)
    }
    if (item.metadata.stage != null && !STAGES.includes(item.metadata.stage)) {
      errors.push(
        `${path}.metadata.stage: found ${JSON.stringify(
          item.metadata.stage,
        )}, must be one of ${STAGES.join(', ')}`,
      )
    }
  }
  if ('expected_output' in item && 'expectedOutput' in item) {
    errors.push(`${path}: use expected_output or expectedOutput, not both`)
  }
  errors.push(
    ...validateExpectedOutput(
      expectedOutputOf(item),
      `${path}.expected_output`,
      tools,
    ),
  )
  return errors
}

export function validateItems(items, options = {}) {
  const tools = options.knownTools ?? null
  if (!Array.isArray(items)) {
    return ['items file must contain a JSON array']
  }
  const errors = items.flatMap((item, index) =>
    validateItem(item, index, tools),
  )
  const seen = new Map()
  items.forEach((item, index) => {
    const id = isObject(item) ? itemId(item) : null
    if (!id) {
      return
    }
    if (seen.has(id)) {
      errors.push(
        `items[${index}]: duplicate id "${id}" (also items[${seen.get(id)}])`,
      )
    } else {
      seen.set(id, index)
    }
  })
  return errors
}
