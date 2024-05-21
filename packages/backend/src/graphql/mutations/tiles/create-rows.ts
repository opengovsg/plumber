import { createTableRows } from '@/models/dynamodb/table-row'
import TableCollaborator from '@/models/table-collaborators'
import TableMetadata from '@/models/table-metadata'

import type { MutationResolvers } from '../../__generated__/types.generated'

const createRows: MutationResolvers['createRows'] = async (
  _parent,
  params,
  context,
) => {
  const { tableId, dataArray } = params.input

  await TableCollaborator.hasAccess(context.currentUser.id, tableId, 'editor')

  const table = await TableMetadata.query().findById(tableId).throwIfNotFound()

  if (!(await table.validateRows(dataArray))) {
    throw new Error('Invalid column id')
  }

  await createTableRows({ tableId, dataArray })

  return true
}

export default createRows
