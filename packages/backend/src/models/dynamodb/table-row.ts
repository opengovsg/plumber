import { IJSONPrimitive } from '@plumber/types'

import { randomUUID } from 'crypto'
import dynamoose from 'dynamoose'
import { Item } from 'dynamoose/dist/Item'

import { rowExistCondition, wrapDynamoDBError } from './helpers'

interface CreateRowInput {
  tableId: string
  data: Record<string, IJSONPrimitive>
}

interface UpdateRowInput {
  tableId: string
  rowId: string
  data: Record<string, IJSONPrimitive>
}

interface DeleteRowInput {
  tableId: string
  rowId: string
}

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

export const createTableRow = async ({
  tableId,
  data,
}: CreateRowInput): Promise<TableRowSchema> => {
  return TableRow.create({
    tableId,
    rowId: randomUUID(),
    data,
  })
}

export const updateTableRow = async ({
  rowId,
  tableId,
  data,
}: UpdateRowInput): Promise<void> => {
  try {
    await TableRow.update(
      {
        tableId,
        rowId,
      },
      {
        data,
      },
      {
        // update only if exists
        condition: rowExistCondition(tableId, rowId),
      },
    )
  } catch (e: unknown) {
    wrapDynamoDBError(e)
  }
}

export const deleteTableRow = async ({
  rowId,
  tableId,
}: DeleteRowInput): Promise<void> => {
  try {
    await TableRow.delete(
      {
        tableId,
        rowId,
      },
      {
        // delete only if exists
        condition: rowExistCondition(tableId, rowId),
      },
    )
  } catch (e: unknown) {
    wrapDynamoDBError(e)
  }
}
