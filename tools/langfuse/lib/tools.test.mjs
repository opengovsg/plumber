import assert from 'node:assert/strict'
import test from 'node:test'

import { knownTools } from './tools.mjs'

test('returns tool names from the backend source', () => {
  const source = '    list_apps: tool<A, B>({\n    create_pipe: tool({'
  assert.deepEqual(knownTools(source), ['list_apps', 'create_pipe'])
})

test('returns null when no tool name parses so callers cannot prune everything', () => {
  assert.equal(knownTools('export const x = 1'), null)
})
