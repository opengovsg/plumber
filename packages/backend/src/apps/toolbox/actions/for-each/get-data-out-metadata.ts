import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

import {
  FOR_EACH_INPUT_SOURCE,
  FOR_EACH_MAX_ITERATIONS,
  FOR_EACH_TABLE_SOURCES,
} from '../../common/constants'

import { dataOutSchema } from './schema'

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
          /**
           * NOTE: this is for backward compatibility with the old dataOut format
           * we check that it is within the FOR_EACH_MAX_ITERATIONS as there are edge cases
           * where the hex encoded columns from Excel is a number
           *
           * TODO (kevinkim-ogp): remove this once all users have moved to the new format
           */
          const isBackwardCompatibilityColumnId =
            !isNaN(Number(id)) && Number(id) <= FOR_EACH_MAX_ITERATIONS
          tempColumnsMetadata[id] = {
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
              isHiddenFromList: isBackwardCompatibilityColumnId,
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
