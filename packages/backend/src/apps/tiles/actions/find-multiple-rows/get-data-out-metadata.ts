import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut } = executionStep

  if (!dataOut?.rows) {
    return null
  }

  const metadata: IDataOutMetadata = {
    rowsFound: {
      label: 'No. of rows found',
    },
    rows: {
      label: 'Data rows',
      displayedValue: `${dataOut.rowsFound} rows`,
    },
  }
  const columnMetadata: IDataOutMetadata = {}
  if (dataOut.columns) {
    Object.entries(dataOut.columns).forEach(([name]) => {
      columnMetadata[name] = {
        label: name,
        // leave as blank to not display column id in the frontend
        displayedValue: '',
      }
    })
  }

  return { ...metadata, columns: columnMetadata }
}

export default getDataOutMetadata
