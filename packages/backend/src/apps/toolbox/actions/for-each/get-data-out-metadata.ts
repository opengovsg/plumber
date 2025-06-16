import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

import { FOR_EACH_INPUT_SOURCE } from '../../common/constants'

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
  const { inputSource, items } = dataOut.data

  const baseMetadata = {
    iterations: {
      label: 'Number of items',
      order: 1,
    },

    // hidden fields
    inputSource: {
      isHidden: true,
    },
  }

  if (inputSource === FOR_EACH_INPUT_SOURCE.CHECKBOX) {
    return {
      ...baseMetadata,
      // NOTE: item is only used when it is a checkbox
      items: { isHidden: true },
      item: {
        label: 'Item',
        type: 'text',
        displayedValue: items[0] ?? '',
      },
    }
  }

  if (
    inputSource === FOR_EACH_INPUT_SOURCE.M365_EXCEL ||
    inputSource === FOR_EACH_INPUT_SOURCE.TILES
  ) {
    const columnsMetadata = items.columns.map((column, index) => ({
      id: { isHidden: true },
      name: { isHidden: true },
      value: {
        label: column.name,
        displayedValue: ' ',
        order: index + 2,
        type: column.id === 'rowId' ? 'tile_row_id' : 'text', // NOTE: only tiles will have rowId
      },
    }))

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
      },
    }
  }
}

export default getDataOutMetadata
