import assert from 'node:assert/strict'
import test from 'node:test'

import { adoptCandidate, findCandidate } from './adopt.mjs'
import { createRedactor } from './redact.mjs'
import { traceToCandidate } from './sample.mjs'

const trace = {
  id: 'trace_1',
  sessionId: 'chat_1',
  metadata: { langfusePrompt: { version: 154 } },
  output: { text: '', toolCalls: [{ toolName: 'create_pipe' }] },
  observations: [
    {
      name: 'ai-chat-stream',
      input: { messages: [{ role: 'user', content: 'Build it' }] },
    },
  ],
}

test('adopts a sampled candidate as a draft item', () => {
  const candidates = [traceToCandidate(trace, createRedactor())]
  const candidate = findCandidate(candidates, 'trace_1')
  const item = adoptCandidate(candidate, {
    scenario: 'formsg_slack_02_build',
    today: '2026-10-17',
  })
  assert.equal(item.id, 'formsg_slack_02_build')
  assert.equal(item.metadata.status, 'draft')
  assert.equal(item.metadata.source_trace_id, 'trace_1')
  assert.equal(item.metadata.prompt_version, 154)
  assert.equal(item.metadata.observed_decision, 'tool_call')
  assert.equal(item.metadata.observed, undefined)
  assert.equal(item.metadata.last_user_message, undefined)
  assert.deepEqual(item.input.messages[0], {
    role: 'user',
    content: 'Build it',
  })
})

test('returns null for an unknown trace', () => {
  assert.equal(findCandidate([], 'nope'), null)
})
