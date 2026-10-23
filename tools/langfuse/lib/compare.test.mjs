import assert from 'node:assert/strict'
import test from 'node:test'

import { compareRuns, formatCompare } from './compare.mjs'

function run(name, rows) {
  return {
    runName: name,
    results: rows.map(([scenario, passed, covers = []]) => ({
      datasetItemId: `id_${scenario}`,
      scenario,
      covers,
      traceId: `${name}_${scenario}`,
      passed,
      comment: passed === false ? 'judge said no' : null,
    })),
  }
}

test('pairs rows and classifies flips', () => {
  const baseline = run('v1', [
    ['a', true, ['tool:x']],
    ['b', false, ['tool:x']],
    ['c', true],
    ['d', false],
    ['e', true],
    ['only_base', true],
  ])
  const candidate = run('v2', [
    ['a', true, ['tool:x']],
    ['b', true, ['tool:x']],
    ['c', false],
    ['d', false],
    ['only_cand', true],
    ['e', null],
  ])
  const result = compareRuns(baseline, candidate, { minSlice: 2 })
  assert.equal(result.counts.bothPass, 1)
  assert.equal(result.counts.bothFail, 1)
  assert.deepEqual(
    result.fixed.map((r) => r.scenario),
    ['b'],
  )
  assert.deepEqual(
    result.broken.map((r) => r.scenario),
    ['c'],
  )
  assert.deepEqual(result.onlyInBaseline, ['only_base'])
  assert.deepEqual(result.onlyInCandidate, ['only_cand'])
  assert.deepEqual(result.unscored, ['e'])
  assert.equal(result.baselinePassRate, 0.5)
  assert.equal(result.candidatePassRate, 0.5)
  assert.equal(result.verdict, 'regression')
  const slice = result.slices.find((s) => s.tag === 'tool:x')
  assert.deepEqual(slice.baseline, { pass: 1, total: 2 })
  assert.deepEqual(slice.candidate, { pass: 2, total: 2 })
  assert.equal(slice.gate, true)
  assert.match(
    formatCompare(result),
    /Broken \(pass -> fail\):\n- c  trace v2_c  judge said no/,
  )
})

test('reports improvement when only fixes moved', () => {
  const result = compareRuns(
    run('v1', [
      ['a', false],
      ['b', true],
    ]),
    run('v2', [
      ['a', true],
      ['b', true],
    ]),
  )
  assert.equal(result.verdict, 'improvement')
  assert.match(formatCompare(result), /only 1 rows moved/)
})

test('reports no_change when nothing moved', () => {
  const result = compareRuns(run('v1', [['a', true]]), run('v2', [['a', true]]))
  assert.equal(result.verdict, 'no_change')
  assert.equal(result.discordant, 0)
})
