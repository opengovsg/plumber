/**
 * Business-critical: local dev environment variable precedence.
 *
 *   1. (top priority) shell env vars, so that we support harnesses like
 *      superset / cursor
 *   2. 1password environment
 *   3. vars from .env-example
 *
 * Layers 1 and 2 both arrive as process.env, so this file pins the boundary
 * app.ts owns: .env-example never outranks a key that already has a value.
 *
 * IMPORTANT: never mock dotenv here. The real dotenv call is the subject.
 */
import { parse } from 'dotenv'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

// BASE_URL is one of the keys .superset/run.sh exports per worktree, and app.ts
// reads it without a hardcoded default.
const KEY = 'BASE_URL'

const placeholders = parse(
  readFileSync(path.resolve(__dirname, '../../../.env-example')),
)

async function loadBaseUrl(value: string | undefined) {
  vi.stubEnv(KEY, value)
  vi.resetModules()
  const { default: appConfig } = await import('@/config/app')
  return appConfig.baseUrl
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('.env-example placeholders', () => {
  it('never overwrite a value the environment already set', async () => {
    const fromHarness = 'https://harness.example.gov.sg'
    expect(placeholders[KEY]).not.toBe(fromHarness)

    await expect(loadBaseUrl(fromHarness)).resolves.toBe(fromHarness)
  })

  it('fill a key that neither the shell nor 1Password set', async () => {
    expect(placeholders[KEY]).toBeTruthy()

    await expect(loadBaseUrl(undefined)).resolves.toBe(placeholders[KEY])
  })
})
