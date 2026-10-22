import assert from 'node:assert/strict'
import { test } from 'node:test'

import { findRunByName } from './read-run.mjs'

const runs = [
  { name: 'chat-v187-20261017-a - 2026-10-17T09:06:15.498Z' },
  { name: 'chat-v187-20261017-b - 2026-10-17T09:06:35.140Z' },
  { name: 'chat-v187-20261017-ab - 2026-10-17T09:07:00.000Z' },
  { name: 'exact' },
]

test('exact name wins over a prefix match', () => {
  assert.equal(findRunByName(runs, 'exact', 'ds').name, 'exact')
})

test('a typed name matching one run by prefix resolves to it', () => {
  assert.equal(
    findRunByName(runs, 'chat-v187-20261017-b', 'ds').name,
    'chat-v187-20261017-b - 2026-10-17T09:06:35.140Z',
  )
})

test('a prefix matching several runs throws and lists them', () => {
  assert.throws(
    () => findRunByName(runs, 'chat-v187-20261017-a', 'ds'),
    /more than one run on dataset "ds"[\s\S]*-a - [\s\S]*-ab - /,
  )
})

test('no match returns undefined', () => {
  assert.equal(findRunByName(runs, 'missing', 'ds'), undefined)
})
