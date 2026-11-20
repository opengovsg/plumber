import assert from 'node:assert/strict'
import test from 'node:test'

import { compareRuns, formatCompare } from './compare.mjs'

function row(scenario, passed, extra = {}) {
  return { scenario, passed, ...extra }
}

function run(name, rows) {
  return {
    runName: name,
    results: rows.map((entry) => ({
      datasetItemId: `id_${entry.scenario}`,
      covers: [],
      safety: false,
      goldHash: 'g1',
      traceId: `${name}_${entry.scenario}`,
      comment: null,
      ...entry,
    })),
  }
}

test('a broken safety row is a regression even when more rows were fixed', () => {
  const result = compareRuns(
    run('v1', [
      row('s', true, { safety: true }),
      row('a', false),
      row('b', false),
    ]),
    run('v2', [
      row('s', false, { safety: true }),
      row('a', true),
      row('b', true),
    ]),
  )
  assert.equal(result.verdict, 'regression')
  assert.deepEqual(
    result.safetyBroken.map((entry) => entry.scenario),
    ['s'],
  )
  assert.match(formatCompare(result), /safety rows broken: s/)
})

test('a drop in a gated slice is a regression', () => {
  const tagged = { covers: ['tool:x'] }
  const result = compareRuns(
    run('v1', [
      row('a', true, tagged),
      row('b', true, tagged),
      row('c', false),
      row('d', false),
    ]),
    run('v2', [
      row('a', true, tagged),
      row('b', false, tagged),
      row('c', true),
      row('d', true),
    ]),
    { minSlice: 2 },
  )
  assert.equal(result.verdict, 'regression')
})

test('rows with changed gold are excluded from pairing', () => {
  const result = compareRuns(
    run('v1', [row('a', true, { goldHash: 'old' })]),
    run('v2', [row('a', false, { goldHash: 'new' })]),
  )
  assert.deepEqual(result.goldChanged, ['a'])
  assert.equal(result.paired, 0)
  assert.equal(result.verdict, 'no_change')
})
