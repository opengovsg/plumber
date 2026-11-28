import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { init } from '@launchdarkly/node-server-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { getLdClientOptions } from '@/helpers/launch-darkly-options'

describe('getLdClientOptions', () => {
  let dir: string
  let flagFile: string

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'ld-flags-'))
    flagFile = path.join(dir, 'ld-flags.json')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('leaves the client online when offline mode is off', () => {
    expect(
      getLdClientOptions({
        launchDarklyOffline: false,
        launchDarklyFlagFile: flagFile,
      }),
    ).toEqual({})
  })

  it('runs offline when the flag file does not exist', () => {
    expect(
      getLdClientOptions({
        launchDarklyOffline: true,
        launchDarklyFlagFile: flagFile,
      }),
    ).toEqual({ offline: true })
  })

  it('serves values from the flag file and fallbacks for other flags', async () => {
    writeFileSync(flagFile, JSON.stringify({ flagValues: { plumpro: true } }))
    const client = init(
      'sdk-placeholder',
      getLdClientOptions({
        launchDarklyOffline: true,
        launchDarklyFlagFile: flagFile,
      }),
    )
    try {
      await client.waitForInitialization()
      const context = { kind: 'user', key: 'tester@open.gov.sg' }
      expect(await client.variation('plumpro', context, false)).toBe(true)
      expect(await client.variation('not-in-file', context, 'fallback')).toBe(
        'fallback',
      )
    } finally {
      client.close()
    }
  })
})
