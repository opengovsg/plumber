import assert from 'node:assert/strict'
import test from 'node:test'

import { listTraces, traceToCandidate } from './sample.mjs'

test('uses a fixed page size so a limit above 100 neither repeats nor skips rows', async () => {
  const all = Array.from({ length: 250 }, (_, index) => ({ id: `t${index}` }))
  const client = {
    api: {
      trace: {
        list: async ({ page, limit }) => ({
          data: all.slice((page - 1) * limit, page * limit),
          meta: { totalPages: Math.ceil(all.length / limit) },
        }),
      },
    },
  }
  const traces = await listTraces(client, { limit: 150 })
  assert.equal(traces.length, 150)
  assert.deepEqual(
    traces.map((trace) => trace.id),
    all.slice(0, 150).map((trace) => trace.id),
  )
})

test('redacts before truncating so a cut email does not leak', () => {
  const filler = 'x '.repeat(147)
  const trace = {
    id: 'trace-1',
    input: {
      messages: [
        {
          role: 'user',
          content: `${filler}jane.tan@agency.gov.sg`,
        },
      ],
    },
    output: { text: 'ok', toolCalls: [] },
  }
  const candidate = traceToCandidate(trace)
  assert.doesNotMatch(candidate.metadata.last_user_message, /jane|@/)
})
