import { describe, expect, it } from 'vitest'

import TableColumnMetadata from '@/models/table-column-metadata'
import { TableRowFilter, TableRowFilterOperator } from '@/models/tiles/types'

import { validateFilters } from '../../common/validate-filters'

const columns = [{ id: 'col-1' }] as TableColumnMetadata[]

describe('validateFilters', () => {
  it.each(Object.values(TableRowFilterOperator))(
    'accepts the %s operator',
    (operator) => {
      expect(() =>
        validateFilters([{ columnId: 'col-1', operator, value: 'x' }], columns),
      ).not.toThrow()
    },
  )

  it('throws on a column that is not in the tile', () => {
    expect(() =>
      validateFilters(
        [{ columnId: 'deleted', operator: TableRowFilterOperator.Equals }],
        columns,
      ),
    ).toThrow('Invalid columnId: deleted')
  })

  it.each([undefined, '', 'not-an-operator'])(
    'throws on an unsupported operator: %s',
    (operator) => {
      expect(() =>
        validateFilters(
          [{ columnId: 'col-1', operator } as unknown as TableRowFilter],
          columns,
        ),
      ).toThrow(`Unsupported filter operator: ${operator}`)
    },
  )
})
