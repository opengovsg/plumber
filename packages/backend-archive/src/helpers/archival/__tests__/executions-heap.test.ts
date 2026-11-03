import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db', () => ({
  archivalDbReader: { raw: vi.fn() },
}))

import { archivalDbReader } from '../db'
import {
  assertTidRangeScanSupported,
  formatTid,
  getExecutionsHeapPages,
  parseTid,
} from '../executions-heap'

describe('executions-heap', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('parseTid / formatTid', () => {
    it('round-trips a ctid', () => {
      expect(parseTid('(12345,67)')).toEqual({ page: 12345, offset: 67 })
      expect(formatTid({ page: 12345, offset: 67 })).toBe('(12345,67)')
    })

    it('rejects malformed ctids', () => {
      expect(() => parseTid('12345,67')).toThrow('invalid ctid')
      expect(() => parseTid('(1,-2)')).toThrow('invalid ctid')
    })
  })

  describe('assertTidRangeScanSupported', () => {
    it('accepts Postgres 14', async () => {
      vi.mocked(archivalDbReader.raw).mockResolvedValue({
        rows: [{ version: '140008' }],
      } as any)
      await expect(assertTidRangeScanSupported()).resolves.toBeUndefined()
    })

    it('rejects Postgres 13', async () => {
      vi.mocked(archivalDbReader.raw).mockResolvedValue({
        rows: [{ version: '130012' }],
      } as any)
      await expect(assertTidRangeScanSupported()).rejects.toThrow(
        'Postgres 14+',
      )
    })
  })

  describe('getExecutionsHeapPages', () => {
    it('parses the page count', async () => {
      vi.mocked(archivalDbReader.raw).mockResolvedValue({
        rows: [{ pages: 45199 }],
      } as any)
      await expect(getExecutionsHeapPages()).resolves.toBe(45199)
    })
  })
})
