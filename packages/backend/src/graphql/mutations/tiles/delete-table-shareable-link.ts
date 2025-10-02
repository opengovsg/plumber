import TableCollaborator from '@/models/table-collaborators'
import TableMetadata from '@/models/table-metadata'

import type { MutationResolvers } from '../../__generated__/types.generated'

const deleteShareableTableLink: MutationResolvers['deleteShareableTableLink'] =
  async (_parent, params, context) => {
    const tableId = params.tableId

    await TableCollaborator.hasAccess(context.currentUser.id, tableId, 'editor')

    const table = await TableMetadata.query()
      .findById(tableId)
      .throwIfNotFound()

    await table.$query().patch({
      viewOnlyKey: null,
    })

    return true
  }

export default deleteShareableTableLink
