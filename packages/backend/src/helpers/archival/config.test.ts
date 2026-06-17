import { describe, expect, it } from 'vitest'

describe('archival/config — postgresReaderHost', () => {
  it('is defined and string-typed', async () => {
    const { archivalConfig } = await import('./config')
    expect(typeof archivalConfig.postgresReaderHost).toBe('string')
    expect(archivalConfig.postgresReaderHost.length).toBeGreaterThan(0)
  })
})
