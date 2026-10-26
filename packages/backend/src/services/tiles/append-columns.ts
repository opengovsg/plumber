import type { ITableColumnConfig } from '@plumber/types'

import TableColumnMetadata from '@/models/table-column-metadata'
import TableMetadata from '@/models/table-metadata'
import { getTableOperations } from '@/models/tiles/factory'

export async function appendTileColumns({
  table,
  names,
  columnConfig,
}: {
  table: TableMetadata
  names: string[]
  columnConfig?: ITableColumnConfig
}): Promise<TableColumnMetadata[]> {
  const tableOperations = getTableOperations(table.db)

  return TableColumnMetadata.transaction(async (trx) => {
    const results = await table
      .$relatedQuery('columns', trx)
      .max('position as position')
    const maxPosition = results[0].position || 0
    const inserted = await table
      .$relatedQuery('columns', trx)
      .insert(
        names.map((name, i) => ({
          name,
          position: maxPosition + i + 1,
          ...(columnConfig && { config: columnConfig }),
        })),
      )
      .returning('id')

    // createTableColumns uses the tiles database, not trx. A throw rolls the
    // metadata back. DDL that already committed on the tiles database stays.
    await tableOperations.createTableColumns(
      table.id,
      inserted.map((column) => column.id),
    )

    return inserted
  })
}
