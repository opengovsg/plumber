import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

import Step from '@/models/step'
import TableColumnMetadata from '@/models/table-column-metadata'

async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut, stepId } = executionStep

  if (!dataOut?.rows) {
    return null
  }

  // NOTE: extract column order from table column metadata so that frontend
  // can display the columns in the same order as in the Tile
  const columnOrder: Record<string, number> = {}
  const step = await Step.query().findById(stepId).throwIfNotFound()
  const tableId = step.parameters.tableId
  const tableColumns = await TableColumnMetadata.getColumns(tableId as string)
  tableColumns.forEach((c) => {
    // position is 0-indexed
    columnOrder[c.id] = c.position + 1
  })

  const metadata: IDataOutMetadata = {
    rows: {
      label: 'List of row(s) found',
      displayedValue: `Preview ${dataOut.rowsFound} row(s)`,
      type: 'array',
      order: 1,
    },
    rowsFound: {
      label: 'Number of rows found',
      order: 2,
    },
    rowId: {
      label: 'Row ID',
      value: 'rowId',
      displayedValue: ' ',
    },
  }

  const columnMetadata: IDataOutMetadata = {}
  if (dataOut.columns) {
    Object.entries(dataOut.columns).forEach(([name, { id }]) => {
      columnMetadata[name] = {
        id: { type: 'hidden' },
        value: {
          label: name,
          order: columnOrder[id] ? columnOrder[id] + 2 : null,
        },
      }
    })
  }
  console.log('columnMetadata', columnMetadata)

  return { ...metadata, columns: columnMetadata }
}

export default getDataOutMetadata
