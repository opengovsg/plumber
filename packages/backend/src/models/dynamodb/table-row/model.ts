import { Entity } from 'electrodb'

import client, { tableName } from '@/config/dynamodb'

import { autoMarshallDataObj } from '../helpers'

import type { GsiOptions } from './types'

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

interface DataWithGsi {
  data: Record<string, string | number | null>
  [key: string]: string | number | null | unknown
}

export function constructDataWithGsis(
  data: Record<string, string | number | null>,
  gsis?: GsiOptions[],
): DataWithGsi {
  if (!gsis) {
    return { data }
  }
  const dataWithGsi: DataWithGsi = { data }
  for (const gsi of gsis) {
    switch (gsi.indexName) {
      case 'gsiString1':
        dataWithGsi.skString1 = data[gsi.columnIdToMap]?.toString() || ''
        break
      default:
        break
    }
  }
  return dataWithGsi
}

export function getGsiSortKey(
  gsis: GsiOptions[],
  columnId: string,
): 'skString1' | undefined {
  const correspondingGsi = gsis.find((gsi) => gsi.columnIdToMap === columnId)
  switch (correspondingGsi?.indexName) {
    case 'gsiString1':
      return 'skString1'
    default:
      return undefined
  }
}
