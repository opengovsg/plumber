import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calibrate,
  formatCalibration,
  labelTemplate,
  mergeLabels,
} from './calibrate.mjs'

const report = {
  runName: 'chat-v154',
  results: [
    { scenario: 'a', traceId: 't1', passed: true },
    { scenario: 'b', traceId: 't2', passed: true },
    { scenario: 'c', traceId: 't3', passed: false, comment: 'wrong tool' },
    { scenario: 'd', traceId: 't4', passed: false },
    { scenario: 'e', traceId: 't5', passed: null },
  ],
}

test('computes true positive and true negative rates', () => {
  const result = calibrate(
    report,
    [
      { scenario: 'a', human: 'pass' },
      { scenario: 'b', human: 'fail' },
      { scenario: 'c', human: 'fail' },
      { scenario: 'd', human: 'pass' },
      { scenario: 'e', human: 'pass' },
      { scenario: 'zz', human: 'pass' },
      { scenario: 'a', run: 'other-run', human: 'fail' },
    ],
    { min: 0.9 },
  )
  assert.deepEqual(result.counts, { tp: 1, tn: 1, fp: 1, fn: 1 })
  assert.equal(result.tpr, 0.5)
  assert.equal(result.tnr, 0.5)
  assert.equal(result.ok, false)
  assert.deepEqual(
    result.disagreements.map((d) => d.scenario),
    ['b', 'd'],
  )
  assert.deepEqual(result.unmatched, ['zz'])
  assert.deepEqual(result.unlabeled, ['e'])
  assert.match(formatCalibration(result), /NOT calibrated/)
})

test('template is stratified by judge verdict', () => {
  const rows = labelTemplate(report, { perClass: 1 })
  assert.deepEqual(
    rows.map((r) => [r.scenario, r.judge, r.human]),
    [
      ['a', 'pass', null],
      ['c', 'fail', null],
    ],
  )
  assert.equal(rows[0].run, 'chat-v154')
})

test('pools labels across reports by run name', () => {
  const a = {
    runName: 'run-a',
    results: [{ scenario: 's1', traceId: 't1', passed: true, comment: '' }],
  }
  const b = {
    runName: 'run-b',
    results: [{ scenario: 's1', traceId: 't2', passed: false, comment: '' }],
  }
  const labels = [
    { scenario: 's1', run: 'run-a', human: 'pass' },
    { scenario: 's1', run: 'run-b', human: 'fail' },
  ]
  const result = calibrate([a, b], labels)
  assert.equal(result.counts.tp, 1)
  assert.equal(result.counts.tn, 1)
  assert.equal(result.runName, 'run-a + run-b')
})

test('labelTemplate --only picks one verdict class', () => {
  const report = {
    runName: 'r',
    results: [
      { scenario: 'p', traceId: '1', passed: true },
      { scenario: 'f', traceId: '2', passed: false },
    ],
  }
  const rows = labelTemplate(report, { only: 'fail' })
  assert.deepEqual(
    rows.map((row) => row.scenario),
    ['f'],
  )
})

test('mergeLabels keeps existing human labels and skips duplicates', () => {
  const existing = [{ scenario: 's1', run: 'r', judge: 'pass', human: 'pass' }]
  const added = [
    { scenario: 's1', run: 'r', judge: 'pass', human: null },
    { scenario: 's2', run: 'r', judge: 'fail', human: null },
  ]
  const merged = mergeLabels(existing, added)
  assert.equal(merged.length, 2)
  assert.equal(merged[0].human, 'pass')
  assert.equal(merged[1].scenario, 's2')
})
