import { IDataOutMetadata } from '@plumber/types'

import TableColumnMetadata from '@/models/table-column-metadata'

/**
 * Helper function to generate dataOut metadata
 * Maps column ids to column names since there is a possibility that column names could be the same
 * and/or contains spaces
 */
export async function generateColumnNameMetadata(
  rowData: Record<string, string | number>,
  parentKey = 'row', // this is the parent key for the row data
): Promise<IDataOutMetadata> {
  const columnMetadata: IDataOutMetadata = {}

  const columnIds = Object.keys(rowData)

  const columns = await TableColumnMetadata.query()
    .findByIds(columnIds)
    .select('id', 'name')

  columns.forEach((column) => {
    columnMetadata[column.id] = {
      label: column.name,
    }
  })
  return { [parentKey]: columnMetadata }
}
