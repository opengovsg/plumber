import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

const BACKEND_ROOT = path.resolve(__dirname, '../..')
const ENTRY_POINTS = ['server.ts', 'worker.ts', 'reconciler.ts']
const TRACER = '@/helpers/tracer'
const INSTRUMENTATION = '@/instrumentation'

function importSpecifiers(entry: string): string[] {
  const source = readFileSync(path.join(BACKEND_ROOT, 'src', entry), 'utf8')
  return [
    ...source.matchAll(/^import\s(?:[^'"]*\sfrom\s)?['"]([^'"]+)['"]/gm),
  ].map((match) => match[1])
}

describe.each(ENTRY_POINTS)('%s', (entry) => {
  it('imports the tracer before any other module', () => {
    expect(importSpecifiers(entry)[0]).toBe(TRACER)
  })

  it('injects dd.service into a log written inside a span', async () => {
    const preamble = importSpecifiers(entry).filter((specifier) =>
      [TRACER, INSTRUMENTATION].includes(specifier),
    )
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        '-r',
        'ts-node/register',
        '-r',
        'tsconfig-paths/register',
        'src/__tests__/fixtures/log-in-span.ts',
        ...preamble,
      ],
      {
        cwd: BACKEND_ROOT,
        env: {
          // IMPORTANT: CI test visibility preloads dd-trace through NODE_OPTIONS. That hides the
          // load order under test and routes the .ts fixture through the ESM loader.
          ...Object.fromEntries(
            Object.entries(process.env).filter(
              ([key]) => key !== 'NODE_OPTIONS' && !key.startsWith('DD_'),
            ),
          ),
          APP_ENV: 'staging',
          TS_NODE_TRANSPILE_ONLY: 'true',
          TS_NODE_TRANSPILER: 'ts-node/transpilers/swc',
          // Keeps dd-trace from sending traces, telemetry or remote config requests.
          DD_TRACE_AGENT_URL: 'http://127.0.0.1:1',
          DD_INSTRUMENTATION_TELEMETRY_ENABLED: 'false',
          DD_REMOTE_CONFIGURATION_ENABLED: 'false',
        },
      },
    )

    const line = stdout
      .split('\n')
      .filter((text) => text.startsWith('{'))
      .map((text) => JSON.parse(text))
      .find((log) => log.message === 'log-in-span')
    expect(line?.dd).toMatchObject({
      service: 'plumber',
      env: 'staging',
      trace_id: expect.any(String),
      span_id: expect.any(String),
    })
  }, 60_000)
})
