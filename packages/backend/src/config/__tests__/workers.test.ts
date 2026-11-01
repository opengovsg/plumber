import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadGraceSeconds(value: string | undefined) {
  vi.stubEnv('DELAY_STEP_GRACE_SECONDS', value)
  vi.resetModules()
  const { DELAY_STEP_GRACE_SECONDS } = await import('@/config/workers')
  return DELAY_STEP_GRACE_SECONDS
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('DELAY_STEP_GRACE_SECONDS', () => {
  it('defaults to 300 seconds', async () => {
    await expect(loadGraceSeconds(undefined)).resolves.toBe(300)
  })

  it('reads the environment variable', async () => {
    await expect(loadGraceSeconds('600')).resolves.toBe(600)
  })

  it.each(['0', '-1', '1.5', 'abc'])('rejects %s', async (value) => {
    await expect(loadGraceSeconds(value)).rejects.toThrow()
  })
})
