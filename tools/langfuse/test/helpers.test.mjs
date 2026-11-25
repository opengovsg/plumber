import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseFlags, parseInclude } from '../lib/cli/options.mjs'
import { EXTRA_FIELDS } from '../lib/constants.mjs'
import { nextWindowMs } from '../lib/langfuse/sessions.mjs'
import { buildListFields } from '../lib/langfuse/traces.mjs'
import { buildFields, slimOutput, toRecord } from '../lib/output/fields.mjs'
import { toCsvCell } from '../lib/output/writer.mjs'
import { fetchInOrder } from '../lib/utils/concurrency.mjs'
import { customRange, parseDate } from '../lib/utils/dates.mjs'

describe('parseFlags', () => {
  it('parses value and boolean flags', () => {
    assert.deepEqual(parseFlags(['--range=7d', '--userId= u1 ', '--yes']), {
      range: '7d',
      userId: 'u1',
      yes: true,
    })
  })

  it('rejects unknown flags', () => {
    assert.throws(
      () => parseFlags(['--enviroment=staging']),
      /Unknown flag --enviroment/,
    )
  })

  it('rejects value flags without a value', () => {
    assert.throws(() => parseFlags(['--userId']), /--userId needs a value/)
    assert.throws(() => parseFlags(['--userId=  ']), /--userId needs a value/)
  })

  it('rejects a value on a boolean flag', () => {
    assert.throws(() => parseFlags(['--yes=no']), /does not take a value/)
  })

  it('rejects positional arguments', () => {
    assert.throws(() => parseFlags(['7d']), /Unexpected argument/)
  })
})

describe('parseInclude', () => {
  it('expands all and dedupes fields', () => {
    assert.deepEqual(parseInclude('all'), EXTRA_FIELDS)
    assert.deepEqual(parseInclude('metrics, metrics,counts'), [
      'metrics',
      'counts',
    ])
    assert.deepEqual(parseInclude(undefined), [])
  })

  it('rejects unknown fields', () => {
    assert.throws(() => parseInclude('latency'), /--include must be one of/)
  })
})

describe('dates', () => {
  it('rejects impossible dates', () => {
    assert.throws(() => parseDate('from', '2026-02-31'), /not a real date/)
    assert.throws(() => parseDate('from', '2026-2-1'), /YYYY-MM-DD/)
  })

  it('makes both custom range days inclusive', () => {
    const { from, to } = customRange('2026-10-01', '2026-10-31')
    assert.equal(from.getDate(), 1)
    assert.equal(to.getMonth(), 10)
    assert.equal(to.getDate(), 1)
  })

  it('rejects a reversed custom range', () => {
    assert.throws(
      () => customRange('2026-10-02', '2026-10-01'),
      /on or before --to/,
    )
  })
})

describe('toCsvCell', () => {
  it('quotes values and escapes quotes', () => {
    assert.equal(toCsvCell('a "b"'), '"a ""b"""')
    assert.equal(toCsvCell({ a: 1 }), '"{""a"":1}"')
    assert.equal(toCsvCell(null), '')
  })

  it('neutralizes formula prefixes', () => {
    for (const prefix of ['=', '+', '-', '@', '\t', '\r']) {
      assert.equal(toCsvCell(`${prefix}1`), `"'${prefix}1"`)
    }
  })
})

describe('fields', () => {
  const trace = {
    id: 't1',
    output: { text: 'hi', request: { body: 'huge' }, finishReason: 'stop' },
    latency: 2,
    observations: ['o1', 'o2'],
    htmlPath: '/p/traces/t1',
  }
  const context = {
    session: { id: 's1', createdAt: '2026-11-01T00:00:00Z' },
    traceCount: 3,
    baseUrl: 'https://rome',
  }

  it('slims AI SDK output and leaves other output alone', () => {
    assert.deepEqual(slimOutput(trace.output), {
      text: 'hi',
      object: undefined,
      finishReason: 'stop',
      model: undefined,
      usage: undefined,
    })
    assert.equal(slimOutput('plain'), 'plain')
  })

  it('builds core fields by default', () => {
    const record = toRecord(trace, buildFields([]), context)
    assert.equal(record.sessionId, 's1')
    assert.equal(record.traceCount, 3)
    assert.equal(record.url, 'https://rome/p/traces/t1')
    assert.equal(record.output.text, 'hi')
    assert.equal('latencySeconds' in record, false)
  })

  it('adds opt-in and raw fields', () => {
    const record = toRecord(
      trace,
      buildFields(['metrics', 'counts', 'fullOutput']),
      context,
    )
    assert.equal(record.latencySeconds, 2)
    assert.equal(record.observationCount, 2)
    assert.deepEqual(record.output, trace.output)
  })
})

describe('buildListFields', () => {
  it('asks only for the field groups the export needs', () => {
    assert.equal(buildListFields([], false), 'core,io')
    assert.equal(
      buildListFields(['metrics', 'counts'], false),
      'core,io,metrics,observations,scores',
    )
    assert.equal(buildListFields(['observations'], true), 'core')
  })
})

describe('nextWindowMs', () => {
  const base = { targetSessions: 100, rangeMs: 1e12 }

  it('doubles an empty window', () => {
    assert.equal(
      nextWindowMs({ ...base, windowMs: 3_600_000, totalItems: 0 }),
      7_200_000,
    )
  })

  it('shrinks at most fourfold per step', () => {
    assert.equal(
      nextWindowMs({ ...base, windowMs: 3_600_000, totalItems: 10_000 }),
      900_000,
    )
  })

  it('never exceeds the range', () => {
    assert.equal(
      nextWindowMs({
        ...base,
        rangeMs: 5_000_000,
        windowMs: 3_600_000,
        totalItems: 0,
      }),
      5_000_000,
    )
  })
})

describe('fetchInOrder', () => {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  it('emits every result in input order', async () => {
    const items = Array.from({ length: 50 }, (_, i) => i)
    const emitted = []
    await fetchInOrder(
      items,
      5,
      async (i) => {
        await delay(i % 3)
        return i
      },
      (i) => emitted.push(i),
    )
    assert.deepEqual(emitted, items)
  })

  it('bounds how far workers run ahead of a slow item', async () => {
    const items = Array.from({ length: 100 }, (_, i) => i)
    let started = 0
    let startedBeforeFirstDone = 0
    await fetchInOrder(
      items,
      5,
      async (i) => {
        started++
        if (i === 0) {
          await delay(50)
          startedBeforeFirstDone = started
        }
        return i
      },
      () => {},
    )
    assert.ok(
      startedBeforeFirstDone <= 20,
      `started ${startedBeforeFirstDone} items before the first finished`,
    )
  })

  it('handles fewer items than workers', async () => {
    const emitted = []
    await fetchInOrder(
      [1],
      5,
      async (i) => i,
      (i) => emitted.push(i),
    )
    assert.deepEqual(emitted, [1])
  })
})
