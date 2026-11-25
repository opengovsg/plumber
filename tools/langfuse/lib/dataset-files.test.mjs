import assert from 'node:assert/strict'
import test from 'node:test'

import { datasetDir, fromLangfuseItem, stubItems } from './dataset-files.mjs'
import { validateItems } from './schema.mjs'

test('maps a slash in the dataset name to nested directories', () => {
  assert.match(
    datasetDir('ai-builder/chat-20261012'),
    /datasets[\\/]ai-builder[\\/]chat-20261012$/,
  )
})

test('converts a Langfuse item and keeps its id', () => {
  const item = fromLangfuseItem({
    id: 'cm1abc',
    input: { messages: [] },
    expectedOutput: { decision: 'clarify' },
    metadata: { scenario: 'formsg_01', covers: ['x'], extra: 1 },
    sourceTraceId: 'trace_9',
  })
  assert.equal(item.id, 'cm1abc')
  assert.equal(item.metadata.scenario, 'formsg_01')
  assert.equal(item.metadata.extra, 1)
  assert.equal(item.metadata.source_trace_id, 'trace_9')
  assert.deepEqual(item.expected_output, { decision: 'clarify' })
})

test('falls back to the id when metadata has no scenario', () => {
  const item = fromLangfuseItem({ id: 'cm2', metadata: null })
  assert.equal(item.metadata.scenario, 'cm2')
  assert.deepEqual(item.metadata.covers, [])
})

test('stubs are drafts that pass the schema apart from the draft marker', () => {
  const tools = ['create_pipe', 'execute_step']
  const items = stubItems(tools, '2026-10-17')
  assert.equal(items.length, 5)
  assert.ok(items.every((item) => item.metadata.status === 'draft'))
  assert.ok(items.some((item) => item.id === 'execute_step_03_confirm_first'))
  assert.deepEqual(validateItems(items, { knownTools: tools }), [])
})
