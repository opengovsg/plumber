import { Entity } from 'electrodb'

import client, { tableName } from '@/config/dynamodb'

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
        validate: (value) => {
          for (const key in value) {
            if (typeof value[key] !== 'string') {
              throw new Error('value must be a string')
            }
          }
        },
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
    },
  },
  {
    client,
    table: tableName,
  },
)
