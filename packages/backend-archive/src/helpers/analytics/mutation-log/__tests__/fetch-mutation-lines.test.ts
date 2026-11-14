import {
  GetQueryResultsCommand,
  type ResultField,
  StartQueryCommand,
} from '@aws-sdk/client-cloudwatch-logs'
import { describe, expect, it, vi } from 'vitest'

import { fetchMutationLines, MAX_QUERY_RESULTS } from '../fetch-mutation-lines'

const START = Date.parse('2026-11-04T16:00:00.000Z')
const END = Date.parse('2026-11-05T16:00:00.000Z')

function insightsTimestamp(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').replace('Z', '')
}

function row(ms: number): ResultField[] {
  return [
    { field: '@timestamp', value: insightsTimestamp(ms) },
    { field: 'query', value: 'mutation { logout }' },
    { field: 'userId', value: 'user-1' },
    { field: 'status', value: '200' },
  ]
}

/**
 * Answers each query with rowsFor(startSec, endSec), after one Running poll.
 */
function fakeClient(rowsFor: (startSec: number, endSec: number) => number[]) {
  const queries = new Map<string, number[]>()
  const ranges: [number, number][] = []
  const send = vi.fn(async (command: unknown) => {
    if (command instanceof StartQueryCommand) {
      const { startTime = 0, endTime = 0 } = command.input
      ranges.push([startTime, endTime])
      const queryId = `q${ranges.length}`
      queries.set(queryId, rowsFor(startTime, endTime))
      return { queryId }
    }
    if (command instanceof GetQueryResultsCommand) {
      const id = command.input.queryId ?? ''
      if (!queries.has(`${id}-polled`)) {
        queries.set(`${id}-polled`, [])
        return { status: 'Running' }
      }
      return { status: 'Complete', results: queries.get(id)?.map(row) }
    }
    throw new Error('unexpected command')
  })
  return { client: { send } as never, ranges }
}

const noSleep = async () => {}

describe('fetchMutationLines', () => {
  it('keeps only lines inside the window', async () => {
    const { client } = fakeClient(() => [
      START - 1,
      START,
      START + 1_000,
      END - 1,
      END,
    ])

    const lines = await fetchMutationLines({
      client,
      logGroup: 'server',
      startMs: START,
      endMs: END,
      sleep: noSleep,
    })

    expect(lines.map((line) => Date.parse(`${line.timestamp}Z`))).toEqual([
      START,
      START + 1_000,
      END - 1,
    ])
    expect(lines[0]).toMatchObject({
      query: 'mutation { logout }',
      userId: 'user-1',
      status: '200',
      variables: null,
    })
  })

  it('splits a window that hits the result cap, without duplicates', async () => {
    const hourSec = 3_600
    // A full cap for any window longer than an hour, else one line per second boundary.
    const { client, ranges } = fakeClient((startSec, endSec) =>
      endSec - startSec > hourSec
        ? Array.from({ length: MAX_QUERY_RESULTS }, () => startSec * 1_000)
        : [startSec * 1_000, endSec * 1_000],
    )

    const lines = await fetchMutationLines({
      client,
      logGroup: 'server',
      startMs: START,
      endMs: END,
      sleep: noSleep,
    })

    const times = lines.map((line) => Date.parse(`${line.timestamp}Z`))
    expect(ranges.length).toBeGreaterThan(1)
    expect(new Set(times).size).toBe(times.length)
    expect(times.every((ms) => ms >= START && ms < END)).toBe(true)
    expect(Math.min(...times)).toBe(START)
  })

  it('fails when the query does not complete', async () => {
    const send = vi.fn(async (command: unknown) =>
      command instanceof StartQueryCommand
        ? { queryId: 'q1' }
        : { status: 'Failed' },
    )

    await expect(
      fetchMutationLines({
        client: { send } as never,
        logGroup: 'server',
        startMs: START,
        endMs: END,
        sleep: noSleep,
      }),
    ).rejects.toThrow('Logs Insights query ended as Failed')
  })
})
