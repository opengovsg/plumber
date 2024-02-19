import { ITableMetadata } from '@plumber/types'

import TableMetadata from '@/models/table-metadata'

async function columns(
  parent: TableMetadata,
): Promise<ITableMetadata['columns']> {
  const columns = await parent
    .$relatedQuery('columns')
    .orderBy('position', 'asc')

  return columns
}

export default {
  columns,
}
