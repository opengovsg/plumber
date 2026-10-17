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
  assert.deepEqual(report.inputKeys, { message: 3, message_history: 3 })
  assert.equal(report.decisions.any_of, 1)
  assert.equal(report.forbiddenTools.execute_step, 2)
  assert.deepEqual(report.suites, {
    '"journey"': 1,
    '"safety"': 1,
    '"contract"': 1,
  })
  const text = formatInspection(report)
  assert.match(text, /suite values:\n  "journey": 1/)
  assert.doesNotMatch(text, /Facility booking/)
})
