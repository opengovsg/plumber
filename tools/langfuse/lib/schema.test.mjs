import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { pruneUnknownTools, validateItems } from './schema.mjs'

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
  assert.ok(errors.some((e) => e.includes('make_pipe')))
  assert.ok(errors.some((e) => e.includes('forbids the expected tool')))
})

test('clarify and respond need some instruction for the judge', () => {
  const errors = validateItems([
    item({
      expected_output: {
        decision: 'clarify',
        must_not_tools: ['execute_step'],
      },
    }),
    item({
      id: 's2',
      metadata: { scenario: 's2', covers: ['x'] },
      expected_output: { decision: 'respond' },
    }),
    item({
      id: 's3',
      metadata: { scenario: 's3', covers: ['x'] },
      expected_output: { decision: 'clarify', must_relay: 'the error' },
    }),
    item({
      id: 's4',
      metadata: { scenario: 's4', covers: ['x'] },
      expected_output: {
        decision: 'respond',
        required_response_intent: 'say no',
      },
    }),
  ])
  assert.equal(
    errors.filter((e) => e.includes('needs an instruction for the judge'))
      .length,
    2,
  )
  assert.ok(errors.some((e) => e.startsWith('items[0]')))
  assert.ok(errors.some((e) => e.startsWith('items[1]')))
})

test('stage is checked and suite is free text', () => {
  const errors = validateItems([
    item({
      metadata: {
        scenario: 'scenario_01',
        covers: ['x'],
        suite: 'journey',
        stage: 'regression',
      },
    }),
    item({
      id: 's2',
      metadata: {
        scenario: 's2',
        covers: ['x'],
        suite: 'anything',
        stage: 'later',
      },
    }),
  ])
  assert.equal(errors.length, 1)
  assert.match(errors[0], /items\[1\].metadata.stage: found "later"/)
})

test('prunes forbidden tools the agent does not have', () => {
  const { items, removed } = pruneUnknownTools(
    [
      item({
        expected_output: {
          decision: 'clarify',
          must_relay: 'x',
          must_not_tools: ['execute_step', 'get_dynamic_data'],
        },
      }),
    ],
    TOOLS,
  )
  assert.deepEqual(items[0].expected_output.must_not_tools, ['execute_step'])
  assert.deepEqual(removed, [{ id: 'scenario_01', tool: 'get_dynamic_data' }])
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
