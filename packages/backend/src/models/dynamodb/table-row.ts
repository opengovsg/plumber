import { IJSONPrimitive } from '@plumber/types'

import dynamoose from 'dynamoose'
import { Item } from 'dynamoose/dist/Item'

export interface TableRowSchema extends Item {
  tableId: string
  rowId: string
  data: Record<string, IJSONPrimitive>
  createdAt: Date
  updatedAt: Date
}

export const TableRow = dynamoose.model<TableRowSchema>(
  'table-row',
  new dynamoose.Schema(
    {
      tableId: {
        type: String,
        hashKey: true,
        required: true,
      },
      rowId: {
        type: String,
        rangeKey: true,
        required: true,
      },
      data: {
        type: Object,
      },
    },
    {
      timestamps: {
        createdAt: {
          // the property name for createdAt (default: 'createdAt')
          createdAt: {
            type: {
              value: Date,
              settings: {
                storage: 'milliseconds',
              },
            },
            // For sorting by createdAt, the doc is wrong, following this https://github.com/dynamoose/dynamoose/issues/1192#issuecomment-1042431035
            index: {
              name: 'createdAtIndex',
              type: 'local',
            },
          },
        },
        updatedAt: {
          // the property name for updatedAt (default: 'updatedAt')
          updatedAt: {
            type: {
              value: Date,
              settings: {
                storage: 'milliseconds',
              },
            },
          },
        },
      },
      // store 1 level deep of nested properties in `data` property
      saveUnknown: ['data.*'],
    },
  ),
)
