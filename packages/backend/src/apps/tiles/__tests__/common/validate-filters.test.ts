import { describe, expect, it } from 'vitest'

import TableColumnMetadata from '@/models/table-column-metadata'
import { TableRowFilter, TableRowFilterOperator } from '@/models/tiles/types'

import {
  validateDynamoDbFilterOperators,
  validateFilterOperators,
  validateFilters,
} from '../../common/validate-filters'

const columns = [{ id: 'col-1' }] as TableColumnMetadata[]

describe('validateFilters', () => {
  it('accepts a column that is in the tile', () => {
    expect(() =>
      validateFilters(
        [{ columnId: 'col-1', operator: TableRowFilterOperator.Equals }],
        columns,
      ),
    ).not.toThrow()
  })

  it('throws on a column that is not in the tile', () => {
    expect(() =>
      validateFilters(
        [{ columnId: 'deleted', operator: TableRowFilterOperator.Equals }],
        columns,
      ),
    ).toThrow('Invalid columnId: deleted')
  })

  it('ignores the operator', () => {
    expect(() =>
      validateFilters(
        [{ columnId: 'col-1' } as unknown as TableRowFilter],
        columns,
      ),
    ).not.toThrow()
  })
})

describe('validateFilterOperators', () => {
  it.each(Object.values(TableRowFilterOperator))(
    'accepts the %s operator',
    (operator) => {
      expect(() =>
        validateFilterOperators([{ columnId: 'col-1', operator, value: 'x' }]),
      ).not.toThrow()
    },
  )

  it.each([undefined, '', 'not-an-operator'])(
    'throws on an unsupported operator: %s',
    (operator) => {
      expect(() =>
        validateFilterOperators([
          { columnId: 'col-1', operator } as unknown as TableRowFilter,
        ]),
      ).toThrow(`Unsupported filter operator: ${operator}`)
    },
  )
})

describe('validateDynamoDbFilterOperators', () => {
  const noOperator = (columnId: string) =>
    ({ columnId, value: 'x' }) as unknown as TableRowFilter

  it('accepts supported operators', () => {
    expect(() =>
      validateDynamoDbFilterOperators([
        { columnId: 'col-1', operator: TableRowFilterOperator.Equals },
        { columnId: 'col-2', operator: TableRowFilterOperator.IsEmpty },
      ]),
    ).not.toThrow()
  })

  it('accepts no operator on a column another filter uses', () => {
    expect(() =>
      validateDynamoDbFilterOperators([
        { columnId: 'col-1', operator: TableRowFilterOperator.Equals },
        noOperator('col-1'),
      ]),
    ).not.toThrow()
  })

  it('throws on no operator on a column no other filter uses', () => {
    expect(() =>
      validateDynamoDbFilterOperators([
        { columnId: 'col-1', operator: TableRowFilterOperator.Equals },
        noOperator('col-2'),
      ]),
    ).toThrow('Unsupported filter operator: undefined')
  })

  it('throws when no filter has an operator', () => {
    expect(() =>
      validateDynamoDbFilterOperators([
        noOperator('col-1'),
        noOperator('col-1'),
      ]),
    ).toThrow('Unsupported filter operator: undefined')
  })
})
