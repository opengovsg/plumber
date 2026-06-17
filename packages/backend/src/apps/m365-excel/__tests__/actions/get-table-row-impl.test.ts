import { beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'

import getTableRowImpl from '../../actions/get-table-row/implementation'
import getTopNTableRows from '../../common/get-top-n-table-rows'

// Mock the getTopNTableRows function
vi.mock('../../common/get-top-n-table-rows')

describe('getTableRowImpl', () => {
  const mockSession = {} as any
  const mockGlobalVariable = {} as any
  const tableId = '{test-table-id}'

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(getTopNTableRows).mockResolvedValue({
      columns: ['Name', 'Email', 'Age', 'Group', 'RSVP-ed'],
      rows: [
        ['Alice', 'alice@example.com', '25', 'A', 'Yes'],
        ['Bob', 'bob@example.com', '30', 'B', 'No'],
        ['Charlie', 'charlie@example.com', '35', 'A', 'Yes'],
        ['David', 'david@example.com', '40', 'B', 'No'],
        ['Eve', 'eve@example.com', '45', 'C', 'Yes'],
        ['Frank', 'frank@example.com', '50', 'C', 'No'],
      ],
      headerSheetRowIndex: 0,
    })
  })

  describe('single filter', () => {
    it('should find a row matching single filter', async () => {
      const result = await getTableRowImpl({
        $: mockGlobalVariable,
        session: mockSession,
        tableId,
        filters: [{ lookupColumn: 'Name', lookupValue: 'Bob' }],
      })

      expect(result).toEqual({
        tableRowIndex: 1,
        sheetRowNumber: 3,
        row: ['Bob', 'bob@example.com', '30', 'B', 'No'],
        columns: ['Name', 'Email', 'Age', 'Group', 'RSVP-ed'],
      })
    })

    it('should return null when no row matches single filter', async () => {
      const result = await getTableRowImpl({
        $: mockGlobalVariable,
        session: mockSession,
        tableId,
        filters: [{ lookupColumn: 'Group', lookupValue: 'D' }],
      })

      expect(result).toBeNull()
    })

    it('should throw error when lookup column does not exist', async () => {
      await expect(
        getTableRowImpl({
          $: mockGlobalVariable,
          session: mockSession,
          tableId,
          filters: [{ lookupColumn: 'NonExistent', lookupValue: 'value' }],
        }),
      ).rejects.toThrow(StepError)
    })
  })

  describe('multiple filters', () => {
    it('should find a row matching all filters', async () => {
      const result = await getTableRowImpl({
        $: mockGlobalVariable,
        session: mockSession,
        tableId,
        filters: [
          { lookupColumn: 'Group', lookupValue: 'A' },
          { lookupColumn: 'RSVP-ed', lookupValue: 'Yes' },
        ],
      })

      // Should match Alice (first matching row, Charlie also matches)
      expect(result).toEqual({
        tableRowIndex: 0,
        sheetRowNumber: 2,
        row: ['Alice', 'alice@example.com', '25', 'A', 'Yes'],
        columns: ['Name', 'Email', 'Age', 'Group', 'RSVP-ed'],
      })
    })

    it('should find the first row when multiple rows match all filters', async () => {
      const result = await getTableRowImpl({
        $: mockGlobalVariable,
        session: mockSession,
        tableId,
        filters: [
          { lookupColumn: 'Group', lookupValue: 'A' },
          { lookupColumn: 'RSVP-ed', lookupValue: 'Yes' },
        ],
      })

      // Alice and Charlie both match (Group=A, RSVP-ed=Yes), should return Alice
      expect(result).toEqual({
        tableRowIndex: 0,
        sheetRowNumber: 2,
        row: ['Alice', 'alice@example.com', '25', 'A', 'Yes'],
        columns: ['Name', 'Email', 'Age', 'Group', 'RSVP-ed'],
      })
    })

    it('should return null when only some filters match', async () => {
      const result = await getTableRowImpl({
        $: mockGlobalVariable,
        session: mockSession,
        tableId,
        filters: [
          { lookupColumn: 'Group', lookupValue: 'B' },
          { lookupColumn: 'RSVP-ed', lookupValue: 'Yes' },
        ],
      })

      // Bob and David are Group B, but both have RSVP-ed=No
      expect(result).toBeNull()
    })

    it('should return null when no rows match any filter', async () => {
      const result = await getTableRowImpl({
        $: mockGlobalVariable,
        session: mockSession,
        tableId,
        filters: [
          { lookupColumn: 'Group', lookupValue: 'D' },
          { lookupColumn: 'Email', lookupValue: 'nonexistent@example.com' },
        ],
      })

      expect(result).toBeNull()
    })

    it('should handle three or more filters', async () => {
      const result = await getTableRowImpl({
        $: mockGlobalVariable,
        session: mockSession,
        tableId,
        filters: [
          { lookupColumn: 'Name', lookupValue: 'Charlie' },
          { lookupColumn: 'Group', lookupValue: 'A' },
          { lookupColumn: 'RSVP-ed', lookupValue: 'Yes' },
        ],
      })

      expect(result).toEqual({
        tableRowIndex: 2,
        sheetRowNumber: 4,
        row: ['Charlie', 'charlie@example.com', '35', 'A', 'Yes'],
        columns: ['Name', 'Email', 'Age', 'Group', 'RSVP-ed'],
      })
    })

    it('should throw error when any filter column does not exist', async () => {
      await expect(
        getTableRowImpl({
          $: mockGlobalVariable,
          session: mockSession,
          tableId,
          filters: [
            { lookupColumn: 'Group', lookupValue: 'A' },
            { lookupColumn: 'NonExistent', lookupValue: 'value' },
          ],
        }),
      ).rejects.toThrow(StepError)
    })
  })

  describe('edge cases', () => {
    it('should handle empty table rows', async () => {
      vi.mocked(getTopNTableRows).mockResolvedValue({
        columns: ['Name', 'Email'],
        rows: [],
        headerSheetRowIndex: 0,
      })

      const result = await getTableRowImpl({
        $: mockGlobalVariable,
        session: mockSession,
        tableId,
        filters: [{ lookupColumn: 'Name', lookupValue: 'Alice' }],
      })

      expect(result).toBeNull()
    })

    it('should handle empty string lookup values', async () => {
      vi.mocked(getTopNTableRows).mockResolvedValue({
        columns: ['Name', 'Email'],
        rows: [
          ['Alice', ''],
          ['Bob', 'bob@example.com'],
        ],
        headerSheetRowIndex: 0,
      })

      const result = await getTableRowImpl({
        $: mockGlobalVariable,
        session: mockSession,
        tableId,
        filters: [
          { lookupColumn: 'Name', lookupValue: 'Alice' },
          { lookupColumn: 'Email', lookupValue: '' },
        ],
      })

      expect(result).toEqual({
        tableRowIndex: 0,
        sheetRowNumber: 2,
        row: ['Alice', ''],
        columns: ['Name', 'Email'],
      })
    })

    it('should calculate correct sheetRowNumber with non-zero headerSheetRowIndex', async () => {
      vi.mocked(getTopNTableRows).mockResolvedValue({
        columns: ['Name', 'Email'],
        rows: [
          ['Alice', 'alice@example.com'],
          ['Bob', 'bob@example.com'],
        ],
        headerSheetRowIndex: 5, // Header is at row 6 (0-indexed row 5)
      })

      const result = await getTableRowImpl({
        $: mockGlobalVariable,
        session: mockSession,
        tableId,
        filters: [{ lookupColumn: 'Name', lookupValue: 'Bob' }],
      })

      expect(result).toEqual({
        tableRowIndex: 1,
        sheetRowNumber: 8, // headerIndex(5) + tableRowIndex(1) + 2
        row: ['Bob', 'bob@example.com'],
        columns: ['Name', 'Email'],
      })
    })

    it('should find last row when it matches', async () => {
      vi.mocked(getTopNTableRows).mockResolvedValue({
        columns: ['Name', 'Status'],
        rows: [
          ['Alice', 'Inactive'],
          ['Bob', 'Inactive'],
          ['Charlie', 'Active'],
        ],
        headerSheetRowIndex: 0,
      })

      const result = await getTableRowImpl({
        $: mockGlobalVariable,
        session: mockSession,
        tableId,
        filters: [{ lookupColumn: 'Status', lookupValue: 'Active' }],
      })

      expect(result).toEqual({
        tableRowIndex: 2,
        sheetRowNumber: 4,
        row: ['Charlie', 'Active'],
        columns: ['Name', 'Status'],
      })
    })

    it('should match exact values (case sensitive)', async () => {
      vi.mocked(getTopNTableRows).mockResolvedValue({
        columns: ['Name', 'Email'],
        rows: [
          ['alice', 'alice@example.com'],
          ['Alice', 'alice2@example.com'],
        ],
        headerSheetRowIndex: 0,
      })

      const result = await getTableRowImpl({
        $: mockGlobalVariable,
        session: mockSession,
        tableId,
        filters: [{ lookupColumn: 'Name', lookupValue: 'Alice' }],
      })

      expect(result).toEqual({
        tableRowIndex: 1,
        sheetRowNumber: 3,
        row: ['Alice', 'alice2@example.com'],
        columns: ['Name', 'Email'],
      })
    })
  })
})
