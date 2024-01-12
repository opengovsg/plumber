import { IDataOutMetadata } from '@plumber/types'

import TableColumnMetadata from '@/models/table-column-metadata'

/**
 * Helper function to generate dataOut metadata
 * Maps column ids to column names since there is a possibility that column names could be the same
 * and/or contains spaces
 */
export async function generateColumnNameMetadata(
  rowData: Record<string, string | number>,
  prefix = 'row.', // this is the parent key for the row data
): Promise<IDataOutMetadata> {
  const metadata: IDataOutMetadata = {}

  const columnIds = Object.keys(rowData)

  const columns = await TableColumnMetadata.query()
    .findByIds(columnIds)
    .select('id', 'name')

  columns.forEach((column) => {
    metadata[`${prefix}${column.id}`] = {
      label: column.name,
    }
  })
  return metadata
}
