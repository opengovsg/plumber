import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { validateItems } from './schema.mjs'

const TOOLS = [
  'create_pipe',
  'execute_step',
  'register_connection',
  'create_step',
  'create_tile',
]

function item(overrides = {}) {
  return {
    id: 'scenario_01',
    input: { messages: [{ role: 'user', content: 'hi' }] },
    expected_output: {
      decision: 'tool_call',
      tool: 'create_pipe',
      must_not_tools: ['execute_step'],
    },
    metadata: { scenario: 'scenario_01', covers: ['tool:create_pipe'] },
    ...overrides,
  }
}

test('accepts the example dataset', () => {
  const items = JSON.parse(
    readFileSync(
      new URL('../datasets/example/items.json', import.meta.url),
      'utf8',
    ),
  )
  assert.deepEqual(validateItems(items, { knownTools: TOOLS }), [])
})

test('rejects unknown tools and a forbidden expected tool', () => {
  const errors = validateItems(
    [
      item({
        expected_output: {
          decision: 'tool_call',
          tool: 'make_pipe',
          must_not_tools: ['make_pipe'],
        },
      }),
    ],
    { knownTools: TOOLS },
  )
  assert.ok(errors.some((e) => e.includes('unknown tool "make_pipe"')))
  assert.ok(errors.some((e) => e.includes('forbids the expected tool')))
})

test('requires an intent for clarify and respond', () => {
  const errors = validateItems([
    item({ expected_output: { decision: 'clarify' } }),
    item({
      id: 'scenario_02',
      metadata: { scenario: 'scenario_02', covers: ['x'] },
      expected_output: { decision: 'respond' },
    }),
  ])
  assert.equal(
    errors.filter((e) => e.includes('required_question_intent')).length,
    1,
  )
  assert.equal(
    errors.filter((e) => e.includes('required_response_intent')).length,
    1,
  )
})

test('rejects duplicate ids, missing covers and bad scenario names', () => {
  const errors = validateItems([
    item(),
    item({ metadata: { scenario: 'scenario_01', covers: [] } }),
    item({ id: 'Bad Name', metadata: { scenario: 'Bad Name', covers: ['a'] } }),
  ])
  assert.ok(errors.some((e) => e.includes('duplicate id')))
  assert.ok(errors.some((e) => e.includes('covers')))
  assert.ok(errors.some((e) => e.includes('lowercase')))
})

test('any_of needs two options and trajectory needs steps', () => {
  const errors = validateItems([
    item({
      expected_output: {
        decision: 'any_of',
        options: [{ decision: 'clarify' }],
      },
    }),
    item({
      id: 's2',
      metadata: { scenario: 's2', covers: ['a'] },
      expected_output: { decision: 'trajectory', trajectory: [] },
    }),
  ])
  assert.ok(errors.some((e) => e.includes('at least two options')))
  assert.ok(errors.some((e) => e.includes('at least one step')))
})

test('skips tool name checks when the tool list is unknown', () => {
  const errors = validateItems([
    item({ expected_output: { decision: 'tool_call', tool: 'anything' } }),
  ])
  assert.deepEqual(errors, [])
})
