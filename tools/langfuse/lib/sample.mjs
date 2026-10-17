import { createRedactor } from './redact.mjs'

const UI_BLOCKS = [
  'CLARIFICATION_DATA',
  'DYNAMIC_PICKER_DATA',
  'COLUMN_TABLE_DATA',
  'TILE_SETUP_DATA',
]

function parseMaybeJson(value) {
  if (typeof value !== 'string') {
    return value
  }
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function messagesOf(trace) {
  const observation = (trace.observations ?? []).find(
    (entry) => entry.name === 'ai-chat-stream' && entry.input != null,
  )
  const input = parseMaybeJson(observation?.input ?? trace.input)
  if (Array.isArray(input?.messages)) {
    return input.messages
  }
  return Array.isArray(input) ? input : null
}

function uiBlockOf(text) {
  if (typeof text !== 'string') {
    return null
  }
  return (
    UI_BLOCKS.find(
      (block) =>
        text.includes(`<!-- ${block}`) || text.includes(`<!--${block}`),
    ) ?? null
  )
}

/**
 * Reads what production did on one turn. The streamText finish event is the
 * trace output, so tool calls and text are both there.
 */
export function observedDecision(trace) {
  const output = parseMaybeJson(trace.output)
  if (output == null || typeof output !== 'object') {
    return {
      decision: 'unknown',
      text: typeof output === 'string' ? output : null,
      toolCalls: [],
    }
  }
  const toolCalls = (output.toolCalls ?? [])
    .map((call) => ({
      tool: call.toolName ?? call.name ?? null,
      input: call.input ?? call.args ?? null,
    }))
    .filter((call) => call.tool)
  const text = typeof output.text === 'string' ? output.text : null
  const block = uiBlockOf(text)
  if (toolCalls.length > 1) {
    return { decision: 'trajectory', text, toolCalls }
  }
  if (toolCalls.length === 1) {
    return { decision: 'tool_call', tool: toolCalls[0].tool, text, toolCalls }
  }
  if (block) {
    return { decision: 'ui_block', ui_block_type: block, text, toolCalls }
  }
  if (text && /\?\s*$/m.test(text.trim())) {
    return { decision: 'clarify', text, toolCalls }
  }
  return { decision: text ? 'respond' : 'unknown', text, toolCalls }
}

function lastUserMessage(messages) {
  const user = [...messages]
    .reverse()
    .find((message) => message.role === 'user')
  return typeof user?.content === 'string' ? user.content : ''
}

/**
 * Turns a production trace into a draft item. The draft is not gold: a human
 * decides the expected output and names the scenario before it enters items.json.
 */
export function traceToCandidate(trace, redactor = createRedactor()) {
  const messages = messagesOf(trace)
  if (!messages || messages.length === 0) {
    return null
  }
  const observed = observedDecision(trace)
  const metadata = parseMaybeJson(trace.metadata) ?? {}
  return {
    id: null,
    input: redactor.redact({ messages }),
    expected_output: {
      decision: observed.decision,
      ...(observed.tool ? { tool: observed.tool } : {}),
      ...(observed.ui_block_type
        ? { ui_block_type: observed.ui_block_type }
        : {}),
      must_not_tools: [],
    },
    metadata: {
      scenario: '',
      covers: observed.tool ? [`tool:${observed.tool}`] : [],
      status: 'draft',
      source_trace_id: trace.id,
      source_session_id: trace.sessionId ?? null,
      prompt_version:
        metadata.langfusePrompt?.version ?? metadata.promptVersion ?? null,
      observed: {
        decision: observed.decision,
        tool: observed.tool ?? null,
        tool_calls: redactor.redact(observed.toolCalls),
        text: redactor.redact(
          observed.text ? observed.text.slice(0, 2000) : null,
        ),
      },
      turn_count: messages.length,
      last_user_message: redactor.redact(
        lastUserMessage(messages).slice(0, 300),
      ),
    },
  }
}

export function summarizeCandidates(candidates) {
  const strata = new Map()
  for (const candidate of candidates) {
    const observed = candidate.metadata.observed
    const key = observed.tool ? `tool_call:${observed.tool}` : observed.decision
    strata.set(key, (strata.get(key) ?? 0) + 1)
  }
  return Object.fromEntries([...strata.entries()].sort((a, b) => b[1] - a[1]))
}

async function listTraces(client, options) {
  const traces = []
  let page = 1
  while (traces.length < options.limit) {
    const response = await client.api.trace.list({
      page,
      limit: Math.min(100, options.limit - traces.length),
      tags: options.tags,
      fromTimestamp: options.from,
      toTimestamp: options.to,
      environment: options.environment,
      orderBy: 'timestamp.desc',
    })
    traces.push(...response.data)
    if (
      page >= (response.meta?.totalPages ?? 1) ||
      response.data.length === 0
    ) {
      break
    }
    page += 1
  }
  return traces
}

export async function sampleTraces(client, options) {
  const redactor = createRedactor()
  const traces = await listTraces(client, options)
  const candidates = []
  for (const summary of traces) {
    const trace = await client.api.trace.get(summary.id)
    const candidate = traceToCandidate(trace, redactor)
    if (candidate) {
      candidates.push(candidate)
    }
  }
  return {
    fetchedAt: new Date().toISOString(),
    filters: {
      tags: options.tags,
      from: options.from ?? null,
      to: options.to ?? null,
      environment: options.environment ?? null,
    },
    tracesSeen: traces.length,
    redactions: redactor.replacements(),
    strata: summarizeCandidates(candidates),
    candidates,
  }
}
