import assert from 'node:assert/strict'
import test from 'node:test'

import {
  observedDecision,
  summarizeCandidates,
  traceToCandidate,
} from './sample.mjs'

function trace(
  output,
  messages = [{ role: 'user', content: 'Build me a pipe for bob@example.com' }],
) {
  return {
    id: 'trace_1',
    sessionId: 'chat_1',
    metadata: { promptVersion: 'production', langfusePrompt: { version: 154 } },
    input: null,
    output,
    observations: [{ name: 'ai-chat-stream', input: { messages } }],
  }
}

test('reads a single tool call from the finish event', () => {
  const observed = observedDecision(
    trace({
      text: '',
      toolCalls: [{ toolName: 'create_pipe', input: { name: 'x' } }],
    }),
  )
  assert.equal(observed.decision, 'tool_call')
  assert.equal(observed.tool, 'create_pipe')
})

test('reads a clarification block, a question and a plain answer', () => {
  assert.equal(
    observedDecision(
      trace({
        text: 'Hi <!-- CLARIFICATION_DATA\nQ: ok?\n- yes\n-->',
        toolCalls: [],
      }),
    ).ui_block_type,
    'CLARIFICATION_DATA',
  )
  assert.equal(
    observedDecision(
      trace({ text: 'Which channel should I post to?', toolCalls: [] }),
    ).decision,
    'clarify',
  )
  assert.equal(
    observedDecision(
      trace({ text: 'A trigger starts the pipe.', toolCalls: [] }),
    ).decision,
    'respond',
  )
  assert.equal(
    observedDecision(
      trace({
        text: '',
        toolCalls: [
          { toolName: 'create_pipe' },
          { toolName: 'update_step_parameters' },
        ],
      }),
    ).decision,
    'trajectory',
  )
})

test('builds a redacted draft with the observed decision in metadata', () => {
  const candidate = traceToCandidate(
    trace({
      text: '',
      toolCalls: [
        { toolName: 'create_pipe', input: { owner: 'bob@example.com' } },
      ],
    }),
  )
  assert.equal(candidate.metadata.status, 'draft')
  assert.equal(candidate.metadata.source_trace_id, 'trace_1')
  assert.equal(candidate.metadata.prompt_version, 154)
  assert.equal(candidate.expected_output.tool, 'create_pipe')
  assert.deepEqual(candidate.metadata.covers, ['tool:create_pipe'])
  assert.equal(
    candidate.input.messages[0].content,
    'Build me a pipe for <EMAIL_1>',
  )
  assert.equal(
    candidate.metadata.observed.tool_calls[0].input.owner,
    '<EMAIL_1>',
  )
  assert.equal(summarizeCandidates([candidate])['tool_call:create_pipe'], 1)
})

test('skips traces without messages', () => {
  assert.equal(
    traceToCandidate({ id: 't', output: {}, observations: [] }),
    null,
  )
})
