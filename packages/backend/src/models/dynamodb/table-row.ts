import { IJSONPrimitive, ITableRow } from '@plumber/types'

import { randomUUID } from 'crypto'
import dynamoose from 'dynamoose'
import { Item } from 'dynamoose/dist/Item'

import { rowExistCondition, wrapDynamoDBError } from './helpers'

export interface CreateRowInput {
  tableId: string
  data: Record<string, IJSONPrimitive>
}

export interface UpdateRowInput {
  tableId: string
  rowId: string
  data: Record<string, IJSONPrimitive>
}

export interface DeleteRowsInput {
  tableId: string
  rowIds: string[]
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

export const deleteTableRows = async ({
  rowIds,
  tableId,
}: DeleteRowsInput): Promise<void> => {
  try {
    let batch = []
    const batchDeletePromises = []
    for (const rowId of rowIds) {
      batch.push({
        tableId,
        rowId,
      })
      if (batch.length === 25 || rowId === rowIds[rowIds.length - 1]) {
        batchDeletePromises.push(TableRow.batchDelete(batch))
        batch = []
      }
    }
    await Promise.all(batchDeletePromises)
    return
  } catch (e: unknown) {
    wrapDynamoDBError(e)
  }
}

export const getAllTableRows = async ({
  tableId,
}: {
  tableId: string
}): Promise<ITableRow[]> => {
  const rows = await TableRow.query('tableId')
    .eq(tableId)
    // TODO: select only existing columns
    .attributes(['rowId', 'data'])
    // sort by createdAt ascending
    .using('createdAtIndex')
    .sort('ascending')
    // return all rows even if more than 1MB
    .all()
    .exec()
  return rows.map((row) => row.toJSON() as ITableRow)
}
