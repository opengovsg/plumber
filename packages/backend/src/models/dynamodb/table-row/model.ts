import { Entity } from 'electrodb'

import client, { tableName } from '@/config/dynamodb'

import { autoMarshallDataObj } from '../helpers'

import { GsiOptions, GSIS, TableRowSortKeyName } from './types'

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
        set: (_, changeObject) => {
          /**
           * We only update the updatedAt if the data is being updated
           * This is to prevent updating the updatedAt when patching GSI
           */
          const keys = Object.keys(changeObject)
          if (keys.some((key) => key === 'data' || key.startsWith('data.'))) {
            return Date.now()
          }
        },
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

export function castGsiValue(value: string | number | null): string | null {
  if (value == null || value === '') {
    return undefined
  }
  return value.toString()
}

export function constructDataWithGsis(
  data: Record<string, string | number | null>,
  gsis?: GsiOptions[],
): DataWithGsi {
  const dataWithoutNullish = Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value != null),
  )
  if (!gsis) {
    return { data: dataWithoutNullish }
  }
  const dataWithGsi: DataWithGsi = { data: dataWithoutNullish }
  for (const gsi of gsis) {
    const value = data[gsi.columnIdToMap]
    switch (gsi.indexName) {
      case 'gsiString1':
        dataWithGsi.skString1 = castGsiValue(value)
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
): TableRowSortKeyName | undefined {
  const correspondingGsi = gsis.find((gsi) => gsi.columnIdToMap === columnId)
  const correspondingSk = GSIS.find(
    (g) => g.gsi === correspondingGsi?.indexName,
  )
  return correspondingSk?.sk
}
