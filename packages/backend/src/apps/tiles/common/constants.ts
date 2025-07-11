import { IFieldVisibilityCondition } from '@plumber/types'

import { TableRowFilterOperator } from '@/models/dynamodb/table-row'

export const FIND_MULTIPLE_ROWS_LIMIT = 500

export const LOOKUP_CONDITIONS_SUBFIELDS = [
  {
    placeholder: 'Column',
    key: 'columnId',
    type: 'dropdown' as const,
    required: true,
    variables: false,
    showOptionValue: false,
    source: {
      type: 'query' as const,
      name: 'getDynamicData' as const,
      arguments: [
        {
          name: 'key',
          value: 'listColumns',
        },
        {
          name: 'parameters.tableId',
          value: '{parameters.tableId}',
        },
      ],
    },
    customStyle: { flex: 1 },
  },
  {
    placeholder: 'Condition',
    key: 'operator',
    type: 'dropdown' as const,
    required: true,
    variables: false,
    showOptionValue: false,
    options: [
      { label: 'Equals to', value: TableRowFilterOperator.Equals },
      {
        label: 'Greater than ',
        value: TableRowFilterOperator.GreaterThan,
      },
      {
        label: 'Greater than or equals to',
        value: TableRowFilterOperator.GreaterThanOrEquals,
      },
      { label: 'Less than', value: TableRowFilterOperator.LessThan },
      {
        label: 'Less than or equals to',
        value: TableRowFilterOperator.LessThanOrEquals,
      },
      { label: 'Begins with', value: TableRowFilterOperator.BeginsWith },
      { label: 'Contains', value: TableRowFilterOperator.Contains },
      {
        label: 'Is empty',
        value: TableRowFilterOperator.IsEmpty,
      },
    ],
    customStyle: { flex: 1 },
  },
  {
    placeholder: 'Value',
    key: 'value',
    type: 'string' as const,
    required: true,
    variables: true,
    hiddenIf: {
      fieldKey: 'operator',
      op: 'equals',
      fieldValue: TableRowFilterOperator.IsEmpty,
    } as IFieldVisibilityCondition,
    customStyle: { flex: 2, minWidth: 0, maxWidth: '50%' },
  },
]
