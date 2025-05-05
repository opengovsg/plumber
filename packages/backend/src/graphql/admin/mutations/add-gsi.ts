import { DataPropertyNames } from 'objection'

import { GSIS } from '@/models/dynamodb/table-row'
import TableColumnMetadata from '@/models/table-column-metadata'

import type { AdminMutationResolvers } from '../../__generated__/types.generated'

const createTable: AdminMutationResolvers['addGsi'] = async (
  _parent,
  params,
  context,
) => {
  const { tableId, columnId, indexName } = params.input

  if (!tableId || !columnId) {
    throw new Error('Table id and column id required')
  }

  const correspondingGsi = GSIS.find((g) => g.gsi === indexName)
  if (!correspondingGsi) {
    throw new Error('Invalid index name')
  }

  const table = await context.currentUser
    .$relatedQuery('tables')
    .findById(tableId)
    .withGraphFetched('columns')
    .throwIfNotFound()

  const correspondingColumn = table.columns.find((c) => c.id === columnId)
  if (!correspondingColumn) {
    throw new Error('Column not found')
  }

  const alreadyHasGsi = table.columns.some((c) => !!c.config.gsi)
  if (alreadyHasGsi) {
    throw new Error('Table already has a GSI')
  }

  await TableColumnMetadata.query()
    .patch({
      ['config:gsi' as DataPropertyNames<TableColumnMetadata>]: {
        indexName: correspondingGsi.gsi,
        type: correspondingGsi.type,
        status: 'pending',
        patchFrom: new Date().toISOString(),
      },
    })
    .where({ id: columnId })

  return true
}

export default createTable
