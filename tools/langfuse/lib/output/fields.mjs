import { PASSTHROUGH_FIELDS } from '../constants.mjs'

/**
 * Keeps the reply text from an AI SDK result.
 *
 * `request` and `steps` repeat the system prompt and tool definitions, which make up most of the export size.
 */
export function slimOutput(output) {
  const isAiSdkResult =
    output !== null &&
    typeof output === 'object' &&
    ('request' in output || 'steps' in output)
  if (!isAiSdkResult) {
    return output
  }
  return {
    text: output.text,
    object: output.object,
    finishReason: output.finishReason,
    model: output.response?.modelId,
    usage: output.totalUsage ?? output.usage,
  }
}

// Getters take the trace and a context of { session, traceCount, baseUrl }.
// They work for list items (observation and score ids) and full traces (objects).
const CORE_FIELDS = [
  ['sessionId', (t, c) => c.session.id],
  ['sessionCreatedAt', (t, c) => c.session.createdAt],
  ['traceCount', (t, c) => c.traceCount],
  ['lastTraceId', (t) => t.id],
  ['lastTraceTimestamp', (t) => t.timestamp],
  ['name', (t) => t.name],
  ['environment', (t) => t.environment],
  ['userId', (t) => t.userId],
  ['tags', (t) => t.tags],
  ['input', (t) => t.input],
  ['output', (t) => slimOutput(t.output)],
  ['url', (t, c) => (t.htmlPath ? `${c.baseUrl}${t.htmlPath}` : undefined)],
]

// Opt-in because Langfuse computes these per trace, which slows each lookup.
const OPTIONAL_FIELDS = {
  metrics: [
    ['latencySeconds', (t) => t.latency],
    ['totalCostUsd', (t) => t.totalCost],
  ],
  counts: [
    ['observationCount', (t) => t.observations?.length ?? 0],
    ['scoreCount', (t) => t.scores?.length ?? 0],
  ],
}

export function buildFields(include) {
  const coreFields = include.includes('fullOutput')
    ? CORE_FIELDS.map((field) =>
        field[0] === 'output' ? ['output', (t) => t.output] : field,
      )
    : CORE_FIELDS
  return [
    ...coreFields,
    ...include.flatMap((field) => OPTIONAL_FIELDS[field] ?? []),
    ...include
      .filter((field) => PASSTHROUGH_FIELDS.includes(field))
      .map((field) => [field, (t) => t[field]]),
  ]
}

export function toRecord(trace, fields, context) {
  return Object.fromEntries(
    fields.map(([name, get]) => [name, get(trace, context) ?? null]),
  )
}
