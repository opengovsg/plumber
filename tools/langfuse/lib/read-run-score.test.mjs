import assert from 'node:assert/strict'
import test from 'node:test'

import { goldHash, scoreOutcome } from './read-run.mjs'

test('only an explicit true or false is a judge outcome', () => {
  assert.equal(scoreOutcome({ value: 1 }), true)
  assert.equal(scoreOutcome({ stringValue: 'True' }), true)
  assert.equal(scoreOutcome({ value: 0 }), false)
  assert.equal(scoreOutcome({ stringValue: 'false' }), false)
  assert.equal(scoreOutcome({ value: null }), null)
  assert.equal(scoreOutcome({ value: 0.4 }), null)
  assert.equal(scoreOutcome({ value: Number.NaN }), null)
  assert.equal(scoreOutcome(null), null)
})

test('gold hash ignores key order and detects edits', () => {
  assert.equal(
    goldHash({ a: 1, b: [{ c: 2, d: 3 }] }),
    goldHash({ b: [{ d: 3, c: 2 }], a: 1 }),
  )
  assert.notEqual(goldHash({ a: 1 }), goldHash({ a: 2 }))
})
