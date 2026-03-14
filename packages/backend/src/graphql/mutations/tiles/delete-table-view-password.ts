import TableCollaborator from '@/models/table-collaborators'
import TableMetadata from '@/models/table-metadata'

import type { MutationResolvers } from '../../__generated__/types.generated'

const deleteTableViewPassword: MutationResolvers['deleteTableViewPassword'] =
  async (_parent, params, context) => {
    const { tableId } = params

    // Must be at least editor
    await TableCollaborator.hasAccess(context.currentUser.id, tableId, 'editor')

    const table = await TableMetadata.query()
      .findById(tableId)
      .throwIfNotFound()

    await table.$query().patch({
      viewOnlyPassword: null,
    })

    return true
  }

export default deleteTableViewPassword
