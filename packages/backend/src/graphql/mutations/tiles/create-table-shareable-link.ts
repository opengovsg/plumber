import { randomUUID } from 'crypto'

import TableCollaborator from '@/models/table-collaborators'
import TableMetadata from '@/models/table-metadata'

import type { MutationResolvers } from '../../__generated__/types.generated'

const createShareableTableLink: MutationResolvers['createShareableTableLink'] =
  async (_parent, params, context) => {
    const tableId = params.tableId

    await TableCollaborator.hasAccess(context.currentUser.id, tableId, 'editor')

    const table = await TableMetadata.query()
      .findById(tableId)
      .throwIfNotFound()

    const newViewOnlyKey = randomUUID()

    await table.$query().patch({
      viewOnlyKey: newViewOnlyKey,
    })

    return newViewOnlyKey
  }

export default createShareableTableLink
