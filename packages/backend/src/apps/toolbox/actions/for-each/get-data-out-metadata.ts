import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

import {
  FOR_EACH_INPUT_SOURCE,
  FOR_EACH_TABLE_SOURCES,
} from '../../common/constants'

import { dataOutSchema } from './schema'

// NOTE: this is for backward compatibility with the old dataOut format
const isBackwardCompatibilityColumnId = (id: string, numColumns: number) => {
  // must be numeric
  // cannot have leading 0
  // must only contain digits
  // must be less than the number of columns
  if (Number(id) < numColumns && /^(0|[1-9]\d*)$/.test(id)) {
    return true
  }

  return false
}

async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut: rawDataOut } = executionStep
  if (!rawDataOut) {
    return null
  }

  const dataOut = dataOutSchema.safeParse(rawDataOut)
  if (dataOut.success === false) {
    console.error(dataOut.error)
    return null
  }
  const { inputSource, items, iterations } = dataOut.data

  const baseMetadata = {
    // NOTE: we expose these two fields to allow users
    // to track the iteration number and create actions
    // when the loop ends using "Only continue if"
    iteration: {
      label: 'Item number',
      displayedValue: iterations > 0 ? '1' : '',
    },
    iterations: {
      label: 'Items found',
    },

    // hidden fields
    inputSource: {
      isHidden: true,
    },
  }

  if (inputSource === FOR_EACH_INPUT_SOURCE.STRING_ARRAY) {
    return {
      ...baseMetadata,
      // NOTE: item is only used when it is a checkbox
      items: { isHidden: true },
      item: {
        label: 'Item',
        type: 'text',
        displayedValue: items[0] ? String(items[0]) : '',
      },
    }
  }

  if (FOR_EACH_TABLE_SOURCES.includes(inputSource)) {
    let columnsMetadata: IDataOutMetadata[] | Record<string, IDataOutMetadata> =
      {}

    // NOTE: this is for backward compatibility with the old dataOut format
    // TODO (kevinkim-ogp): remove this once all users have moved to the new format
    if (typeof items.columns === 'object' && Array.isArray(items.columns)) {
      columnsMetadata = items.columns.map((column, index) => ({
        id: { isHidden: true },
        name: { isHidden: true },
        value: {
          label: column.name,
          displayedValue:
            column.id === 'rowId'
              ? items?.rows?.[0]?.rowId ?? ''
              : String(items?.rows?.[0]?.data?.[column.id] ?? ''),
          order: index + 1,
          type: column.id === 'rowId' ? 'tile_row_id' : 'text', // NOTE: only tiles will have rowId
        },
      }))
    } else {
      const tempColumnsMetadata = {} as Record<string, IDataOutMetadata>

      Object.entries(items.columns)
        .sort((a, b) => a[1].order - b[1].order)
        .forEach(([id, column], index) => {
          const isBackwardCompat = isBackwardCompatibilityColumnId(
            id,
            Object.keys(items.columns).length,
          )

          tempColumnsMetadata[id] = {
            id: { isHidden: true },
            name: { isHidden: true },
            value: {
              label: isBackwardCompat ? `(Fix me) ${column.name}` : column.name,
              displayedValue:
                column.id === 'rowId'
                  ? items?.rows?.[0]?.rowId ?? ''
                  : String(items?.rows?.[0]?.data?.[column.id] ?? ''),
              order: index + 1,
              type: column.id === 'rowId' ? 'tile_row_id' : 'text', // NOTE: only tiles will have rowId
              /**
               * NOTE: this is for backward compatibility with the old dataOut format
               *
               * TODO (kevinkim-ogp): remove this once all users have moved to the new format
               */
              isHiddenFromList: isBackwardCompat,
            },
            order: { isHidden: true },
          }
        })
      columnsMetadata = tempColumnsMetadata
    }

    const rowsMetadata = items.rows.map(() => ({
      rowId: { isHidden: true },
      data: {
        isHidden: true,
      },
    }))

    return {
      ...baseMetadata,
      items: {
        columns: columnsMetadata,
        rows: rowsMetadata,
        inputSource: {
          isHidden: true,
        },
      },
    }
  }

  return null
}

export default getDataOutMetadata
