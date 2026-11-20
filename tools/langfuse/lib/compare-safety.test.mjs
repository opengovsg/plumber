import assert from 'node:assert/strict'
import test from 'node:test'

import { compareRuns, formatCompare } from './compare.mjs'

function run(name, rows) {
  return {
    runName: name,
    results: rows.map(
      ([scenario, passed, { covers = [], safety = false, gold = 'g1' } = {}]) => ({
        datasetItemId: `id_${scenario}`,
        scenario,
        covers,
        safety,
        goldHash: gold,
        traceId: `${name}_${scenario}`,
        passed,
        comment: null,
      }),
    ),
  }
}

test('a broken safety row is a regression even when more rows were fixed', () => {
  const result = compareRuns(
    run('v1', [
      ['s', true, { safety: true }],
      ['a', false],
      ['b', false],
    ]),
    run('v2', [
      ['s', false, { safety: true }],
      ['a', true],
      ['b', true],
    ]),
  )
  assert.equal(result.verdict, 'regression')
  assert.deepEqual(
    result.safetyBroken.map((row) => row.scenario),
    ['s'],
  )
  assert.match(formatCompare(result), /safety rows broken: s/)
})

test('a drop in a gated slice is a regression', () => {
  const result = compareRuns(
    run('v1', [
      ['a', true, { covers: ['tool:x'] }],
      ['b', true, { covers: ['tool:x'] }],
      ['c', false],
      ['d', false],
    ]),
    run('v2', [
      ['a', true, { covers: ['tool:x'] }],
      ['b', false, { covers: ['tool:x'] }],
      ['c', true],
      ['d', true],
    ]),
    { minSlice: 2 },
  )
  assert.equal(result.verdict, 'regression')
})

test('rows with changed gold are excluded from pairing', () => {
  const result = compareRuns(
    run('v1', [['a', true, { gold: 'old' }]]),
    run('v2', [['a', false, { gold: 'new' }]]),
  )
  assert.deepEqual(result.goldChanged, ['a'])
  assert.equal(result.paired, 0)
  assert.equal(result.verdict, 'no_change')
})
