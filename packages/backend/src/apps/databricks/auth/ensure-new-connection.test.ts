import { afterEach, describe, expect, it, vi } from 'vitest'

import logger from '@/helpers/logger'

import { isDatabricksNewEnabled } from './ensure-new-connection'

describe('isDatabricksNewEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('returns false when the new hostname is empty and the override is true', async () => {
    vi.stubEnv('DATABRICKS_NEW_CONNECTION_ENABLED', 'true')
    vi.stubEnv('DATABRICKS_NEW_SERVER_HOSTNAME', '')
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => null)

    await expect(isDatabricksNewEnabled('officer@example.com')).resolves.toBe(
      false,
    )

    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith(
      'Databricks new credentials are missing',
    )
  })

  it('returns false for a false override without reading the new config', async () => {
    vi.stubEnv('DATABRICKS_NEW_CONNECTION_ENABLED', 'false')
    vi.stubEnv('DATABRICKS_NEW_SERVER_HOSTNAME', '')
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => null)

    await expect(isDatabricksNewEnabled('officer@example.com')).resolves.toBe(
      false,
    )

    expect(errorSpy).not.toHaveBeenCalled()
  })
})
