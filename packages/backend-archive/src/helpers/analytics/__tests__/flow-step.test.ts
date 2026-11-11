import type { Knex } from 'knex'
import { describe, expect, it, vi } from 'vitest'

import { fetchFlowStepPages, toResourceId } from '../tables/flow-step'

describe('toResourceId', () => {
  it.each([
    ['tiles', 'table-1', 'table-1'],
    ['slack', 'C123', 'C123'],
    ['tiles', '{{step.abc.tableId}}', null],
    ['tiles', '', null],
    ['tiles', null, null],
    [
      'custom-api',
      'https://api.example.gov.sg/users/42?key=x',
      'api.example.gov.sg',
    ],
    ['custom-api', 'https://{{step.abc.host}}/users', null],
    ['custom-api', 'not a url', null],
  ])('maps %s %s to %s', (appKey, value, expected) => {
    expect(toResourceId(appKey, value)).toBe(expected)
  })
})

function sqlRow(stepId: string, flowId: string) {
  return {
    step_id: stepId,
    flow_id: flowId,
    position: 1,
    app_key: 'tiles',
    action_key: 'createTileRow',
    step_type: 'action',
    connection_id: null as string | null,
    status: 'completed',
    created_at: new Date('2026-11-01T00:00:00.000Z'),
    updated_at: new Date('2026-11-01T00:00:00.000Z'),
    deleted_at: null as Date | null,
    updated_by_user_id: null as string | null,
    created_by_ai: false,
    updated_by_ai: false,
    resource_value: `table-${stepId}`,
  }
}

describe('fetchFlowStepPages', () => {
  it('pages by pipe, then step, until a short page', async () => {
    const raw = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [sqlRow('s1', 'flow-a'), sqlRow('s2', 'flow-b')],
      })
      .mockResolvedValueOnce({ rows: [sqlRow('s3', 'flow-b')] })

    const pages = []
    for await (const page of fetchFlowStepPages(
      { raw } as unknown as Knex,
      null,
      2,
    )) {
      pages.push(page.map((row) => [row.step_id, row.resource_id]))
    }

    expect(pages).toEqual([
      [
        ['s1', 'table-s1'],
        ['s2', 'table-s2'],
      ],
      [['s3', 'table-s3']],
    ])
    // The second page starts after the last pipe and step of the first.
    expect(raw.mock.calls[1][1].slice(0, 2)).toEqual(['flow-b', 's2'])
  })
})
