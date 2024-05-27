import logger from '@/helpers/logger'
import TableCollaborator from '@/models/table-collaborators'
import User from '@/models/user'

import type { MutationResolvers } from '../../__generated__/types.generated'

const deleteTableCollaborator: MutationResolvers['deleteTableCollaborator'] =
  async (_parent, params, context) => {
    const { tableId, email } = params.input as {
      tableId: string
      email: string
    }

    await TableCollaborator.hasAccess(context.currentUser.id, tableId, 'editor')

    const collaboratorUser = await User.query()
      .findOne({
        email,
      })
      .throwIfNotFound()

    try {
      await TableCollaborator.query().delete().where({
        table_id: tableId,
        user_id: collaboratorUser.id,
      })
    } catch (e) {
      logger.error({
        message: 'Failed to delete collaborator',
        data: {
          tableId,
          email,
        },
        userId: context.currentUser.id,
        error: e,
      })
      throw new Error('Failed to delete collaborator')
    }

    return true
  }

export default deleteTableCollaborator
