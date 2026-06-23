import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('archival/config', () => {
  const READER_HOST = 'test-reader.internal'

  beforeEach(() => {
    vi.resetModules()
    process.env.ARCHIVE_POSTGRES_READER_HOST = READER_HOST
  })

  afterEach(() => {
    delete process.env.ARCHIVE_POSTGRES_READER_HOST
  })

  it('reads postgresReaderHost from ARCHIVE_POSTGRES_READER_HOST', async () => {
    const { archivalConfig } = await import('../config')
    expect(archivalConfig.postgresReaderHost).toBe(READER_HOST)
  })

  it('throws when ARCHIVE_POSTGRES_READER_HOST is not set', async () => {
    delete process.env.ARCHIVE_POSTGRES_READER_HOST
    await expect(import('../config')).rejects.toThrow(
      'ARCHIVE_POSTGRES_READER_HOST',
    )
  })
})
