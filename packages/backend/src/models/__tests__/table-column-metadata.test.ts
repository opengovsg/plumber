import { describe, expect, it } from 'vitest'

import TableColumnMetadata from '../table-column-metadata'

describe('TableColumnMetadata', () => {
  describe('getGsisFromColumns', () => {
    it('returns GSI options for columns with ready GSI status', () => {
      const columns = [
        {
          id: '1',
          config: { gsi: { status: 'ready', indexName: 'index1' } },
        },
        {
          id: '2',
          config: { gsi: { status: 'pending', indexName: 'index2' } },
        },
        {
          id: '3',
          config: { gsi: { status: 'ready', indexName: 'index3' } },
        },
      ] as TableColumnMetadata[]

      const result = TableColumnMetadata.getGsisFromColumns(columns)

      expect(result).toEqual([
        {
          indexName: 'index1',
          columnIdToMap: '1',
        },
        {
          indexName: 'index3',
          columnIdToMap: '3',
        },
      ])
    })

    it('returns empty array when no columns have ready GSI status', () => {
      const columns = [
        {
          id: '1',
          config: {
            gsi: { status: 'pending', indexName: 'gsi1', type: 'string' },
          },
        },
        {
          id: '2',
          config: {},
        },
      ] as TableColumnMetadata[]

      const result = TableColumnMetadata.getGsisFromColumns(columns)

      expect(result).toEqual([])
    })
  })
})
