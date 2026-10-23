import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadThreshold(value: string | undefined) {
  vi.stubEnv('OVERDUE_DELAY_STEP_THRESHOLD_SECONDS', value)
  vi.resetModules()
  const { OVERDUE_DELAY_STEP_THRESHOLD_SECONDS } =
    await import('@/config/workers')
  return OVERDUE_DELAY_STEP_THRESHOLD_SECONDS
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('OVERDUE_DELAY_STEP_THRESHOLD_SECONDS', () => {
  it('defaults to 300 seconds', async () => {
    await expect(loadThreshold(undefined)).resolves.toBe(300)
  })

  it('reads the environment variable', async () => {
    await expect(loadThreshold('600')).resolves.toBe(600)
  })

  it.each(['0', '-1', '1.5', 'abc'])('rejects %s', async (value) => {
    await expect(loadThreshold(value)).rejects.toThrow()
  })
})
