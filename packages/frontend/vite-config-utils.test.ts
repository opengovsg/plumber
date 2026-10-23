import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { build, type InlineConfig, loadConfigFromFile } from 'vite'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// Builds the real Vite configs because Rolldown decides whether a log handler
// failure aborts the build. A unit test of the plugin hooks cannot catch that.
const CONFIGS = [
  { name: 'app', file: 'vite.config.ts' },
  { name: 'library', file: 'vite.config.lib.ts' },
] as const

let fixtureDir: string

beforeAll(async () => {
  // Vite only warns about externalized builtins in production builds, and
  // Vitest sets NODE_ENV to "test".
  vi.stubEnv('NODE_ENV', 'production')
  fixtureDir = await mkdtemp(join(tmpdir(), 'vite-guardrail-'))
  await writeFile(
    join(fixtureDir, 'leaky.ts'),
    "import path from 'node:path'\nexport const joined = path.join('a', 'b')\n",
  )
  await writeFile(
    join(fixtureDir, 'safe.ts'),
    "export const joined = ['a', 'b'].join('/')\n",
  )
})

afterAll(async () => {
  vi.unstubAllEnvs()
  await rm(fixtureDir, { recursive: true, force: true })
})

async function buildWithEntry(configFile: string, entry: string) {
  const loaded = await loadConfigFromFile(
    { command: 'build', mode: 'test' },
    resolve(__dirname, configFile),
  )
  const config = loaded!.config
  const { lib } = config.build ?? {}
  const inlineConfig: InlineConfig = {
    ...config,
    configFile: false,
    logLevel: 'silent',
    build: {
      ...config.build,
      write: false,
      ...(lib
        ? { lib: { ...lib, entry: { fixture: entry } } }
        : {
            rolldownOptions: { ...config.build?.rolldownOptions, input: entry },
          }),
    },
  }
  return build(inlineConfig)
}

describe.each(CONFIGS)('$name build config', ({ file }) => {
  // The library config runs vite-plugin-dts, which typechecks the package.
  it(
    'rejects a bundle that imports a Node builtin',
    async () => {
      await expect(
        buildWithEntry(file, join(fixtureDir, 'leaky.ts')),
      ).rejects.toThrow(/\[vite-guardrail\].*node:path/s)
    },
    120_000,
  )

  it(
    'builds a browser-safe bundle',
    async () => {
      await expect(
        buildWithEntry(file, join(fixtureDir, 'safe.ts')),
      ).resolves.toBeDefined()
    },
    120_000,
  )
})
