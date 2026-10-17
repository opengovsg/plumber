import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { formatInspection, inspectItems } from './inspect.mjs'

test('summarises shapes without item content', () => {
  const items = JSON.parse(
    readFileSync(
      new URL('../datasets/example/items.json', import.meta.url),
      'utf8',
    ),
  )
  const report = inspectItems(items)
  assert.equal(report.items, 3)
  assert.deepEqual(report.inputKeys, { messages: 3 })
  assert.equal(report.decisions.any_of, 1)
  assert.equal(report.forbiddenTools.execute_step, 2)
  assert.deepEqual(report.suites, { '"regression"': 3 })
  const text = formatInspection(report)
  assert.match(text, /suite values:\n  "regression": 3/)
  assert.doesNotMatch(text, /Facility booking/)
})
