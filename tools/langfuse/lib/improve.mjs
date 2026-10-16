/**
 * Turns a failed eval row into a safer expected output, or leaves it for review.
 * Forbidden-tool failures are never rewritten. Those are model misses.
 */

export function parseJsonObject(value) {
  if (value == null) {
    return null
  }
  if (typeof value === 'object') {
    return value
  }
  if (typeof value !== 'string') {
    return null
  }
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function calledTools(output) {
  if (!output) {
    return []
  }
  if (output.decision === 'tool_call' && output.tool) {
    return [output.tool]
  }
  if (output.decision === 'trajectory' && Array.isArray(output.trajectory)) {
    return output.trajectory.map((entry) => entry?.tool).filter(Boolean)
  }
  return []
}

function forbiddenHit(expected, output) {
  const forbidden = new Set(expected.must_not_tools ?? [])
  return calledTools(output).find((tool) => forbidden.has(tool)) ?? null
}

function isClarificationBlock(output) {
  return (
    output?.decision === 'ui_block' &&
    output.ui_block?.type === 'CLARIFICATION_DATA'
  )
}

function optionMatches(option, output) {
  if (!option || option.decision !== output?.decision) {
    return false
  }
  if (option.decision === 'ui_block' && option.ui_block_type) {
    return output.ui_block?.type === option.ui_block_type
  }
  if (option.decision === 'tool_call' && option.tool) {
    return output.tool === option.tool
  }
  return true
}

function isWebhookOrUnpublish(expected, metadata) {
  const text = [
    expected.required_question_intent,
    expected.required_response_intent,
    expected.reason,
  ]
    .filter(Boolean)
    .join(' ')
  if (/webhook|overwrite|unpublish/i.test(text)) {
    return true
  }
  const covers = metadata?.covers ?? []
  return covers.some((cover) => String(cover).includes('register_connection'))
}

function isSendConfirm(expected, metadata) {
  if (isWebhookOrUnpublish(expected, metadata)) {
    return false
  }
  const text = [
    expected.required_question_intent,
    expected.required_response_intent,
  ]
    .filter(Boolean)
    .join(' ')
  return /send|slack|sms|message/i.test(text)
}

function askedToConfirm(output) {
  return output?.decision === 'clarify' || isClarificationBlock(output)
}

function dropWarning(expected) {
  const next = { ...expected }
  if (next.required_fields) {
    const fields = { ...next.required_fields }
    delete fields.warning
    if (Object.keys(fields).length === 0) {
      delete next.required_fields
    } else {
      next.required_fields = fields
    }
  }
  return next
}

function widenClarify(expected) {
  return {
    ...expected,
    decision: 'any_of',
    options: [
      { decision: 'clarify' },
      { decision: 'ui_block', ui_block_type: 'CLARIFICATION_DATA' },
    ],
  }
}

export function proposeImprovement(failure) {
  const expected = parseJsonObject(failure.expectedOutput)
  const output = parseJsonObject(failure.output)
  const metadata = parseJsonObject(failure.metadata) ?? failure.metadata ?? {}

  if (!expected || !output) {
    return {
      action: 'skip',
      reason: 'Input or output is not a JSON object.',
    }
  }

  const hit = forbiddenHit(expected, output)
  if (hit) {
    return {
      action: 'skip',
      reason: `Model called forbidden tool ${hit}.`,
    }
  }

  if (
    expected.decision === 'any_of' &&
    Array.isArray(expected.options) &&
    expected.options.some((option) => optionMatches(option, output))
  ) {
    return {
      action: 'judge_miss',
      reason:
        'Model decision is already one of the any_of options. Re-run the judge. Do not change the gold.',
    }
  }

  if (expected.decision === 'clarify' && isClarificationBlock(output)) {
    return {
      action: 'update',
      reason:
        'Production asks with a CLARIFICATION_DATA block. Gold only allowed prose clarify.',
      expectedOutput: widenClarify(expected),
    }
  }

  if (
    expected.required_fields?.warning === true &&
    isSendConfirm(expected, metadata) &&
    askedToConfirm(output)
  ) {
    return {
      action: 'update',
      reason:
        'A real send asks for confirmation. It does not use the FormSG webhook warning flag.',
      expectedOutput: dropWarning(expected),
    }
  }

  return {
    action: 'skip',
    reason: 'No safe gold edit. Review the judge comment before changing the row.',
  }
}

export function proposeAll(failures) {
  return failures.map((failure) => ({
    datasetItemId: failure.datasetItemId,
    scenario: failure.scenario ?? failure.metadata?.scenario ?? null,
    traceId: failure.traceId,
    comment: failure.score?.comment ?? null,
    ...proposeImprovement(failure),
  }))
}

export function applyProposals(items, proposals) {
  const updates = new Map(
    proposals
      .filter((proposal) => proposal.action === 'update' && proposal.scenario)
      .map((proposal) => [proposal.scenario, proposal.expectedOutput]),
  )
  let applied = 0
  const next = items.map((item) => {
    const scenario = item.metadata?.scenario
    if (!scenario || !updates.has(scenario)) {
      return item
    }
    applied += 1
    const expectedKey =
      'expected_output' in item ? 'expected_output' : 'expectedOutput'
    return { ...item, [expectedKey]: updates.get(scenario) }
  })
  return { items: next, applied }
}
