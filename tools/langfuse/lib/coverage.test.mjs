import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { coverageReport, formatCoverage, toolOfTag } from './coverage.mjs'

const TOOLS = [
  'create_pipe',
  'execute_step',
  'register_connection',
  'delete_step',
]

test('reads tools from new and legacy tag forms', () => {
  assert.equal(toolOfTag('tool:create_pipe', TOOLS), 'create_pipe')
  assert.equal(toolOfTag('execute_step:confirmation', TOOLS), 'execute_step')
  assert.equal(toolOfTag('app:slack', TOOLS), null)
})

test('counts expected, forbidden and tagged tools and lists gaps', () => {
  const items = JSON.parse(
    readFileSync(
      new URL('../datasets/example/items.json', import.meta.url),
      'utf8',
    ),
  )
  const report = coverageReport(items, { knownTools: TOOLS })
  assert.equal(report.total, 3)
  assert.equal(report.byTool.create_pipe.expected, 1)
  assert.equal(report.byTool.create_pipe.forbidden, 1)
  assert.equal(report.byTool.execute_step.forbidden, 2)
  assert.equal(report.byTool.execute_step.expected, 0)
  assert.equal(report.byApp.slack, 2)
  assert.ok(report.gaps.includes('execute_step: no item expects this tool'))
  assert.ok(report.gaps.includes('delete_step: no item forbids this tool'))
  assert.ok(
    !report.gaps.includes('no item expects a plain answer with no tool call'),
  )
  assert.match(formatCoverage(report), /Gaps:/)
})

test('counts any_of and trajectory tools as expected', () => {
  const report = coverageReport(
    [
      {
        input: {},
        expected_output: {
          decision: 'any_of',
          options: [
            { decision: 'tool_call', tool: 'create_pipe' },
            { decision: 'clarify' },
          ],
        },
        metadata: { scenario: 'a', covers: ['x'] },
      },
      {
        input: {},
        expected_output: {
          decision: 'trajectory',
          trajectory: [{ tool: 'create_pipe' }, { tool: 'execute_step' }],
        },
        metadata: { scenario: 'b', covers: ['x'] },
      },
    ],
    { knownTools: TOOLS },
  )
  assert.equal(report.byTool.create_pipe.expected, 2)
  assert.equal(report.byTool.execute_step.expected, 1)
})
