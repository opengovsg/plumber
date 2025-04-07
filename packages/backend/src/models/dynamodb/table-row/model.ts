import { Entity } from 'electrodb'

import client, { tableName } from '@/config/dynamodb'

import { autoMarshallDataObj } from '../helpers'

export const TableRow = new Entity(
  {
    model: {
      entity: 'table-row',
      version: '1',
      service: 'tiles',
    },
    attributes: {
      tableId: {
        type: 'string',
        readOnly: true,
        required: true,
      },
      rowId: {
        type: 'string',
        readOnly: true,
        required: true,
      },
      data: {
        type: 'any',
        required: true,
        set: autoMarshallDataObj,
      },
      createdAt: {
        type: 'number',
        required: true,
        default: () => Date.now(),
      },
      updatedAt: {
        type: 'number',
        watch: '*',
        required: true,
        default: () => Date.now(),
        set: () => Date.now(),
      },
      skString1: {
        type: 'string',
        required: false,
      },
    },
    indexes: {
      byRowId: {
        pk: {
          field: 'tableId',
          composite: ['tableId'],
        },
        sk: {
          field: 'rowId',
          composite: ['rowId'],
        },
      },
      byCreatedAt: {
        index: 'createdAtIndex',
        pk: {
          field: 'tableId',
          composite: ['tableId'],
        },
        sk: {
          field: 'createdAt',
          composite: ['createdAt'],
        },
      },
      byGsiString1: {
        index: 'gsiString1',
        pk: {
          field: 'tableId',
          composite: ['tableId'],
        },
        sk: {
          field: 'skString1',
          composite: ['skString1'],
        },
      },
    },
  },
  {
    client,
    table: tableName,
  },
)

export function getSkKeyValue(
  indexName: string,
  value: unknown,
): { [key: string]: unknown } {
  switch (indexName) {
    case 'gsiString1':
      return { skString1: value.toString() }
    default:
      return {}
  }
}
