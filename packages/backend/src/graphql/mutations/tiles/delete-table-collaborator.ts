import { BadUserInputError } from '@/errors/graphql-errors'
import { validateAndParseEmail } from '@/helpers/email-validator'
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

    const validatedEmail = await validateAndParseEmail(email)
    if (!validatedEmail) {
      throw new BadUserInputError('Invalid collaborator email')
    }

    if (validatedEmail === context.currentUser.email) {
      throw new BadUserInputError('Cannot remove yourself')
    }

    const collaboratorUser = await User.query()
      .findOne({
        email: validatedEmail,
      })
      .throwIfNotFound()

    try {
      await TableCollaborator.query()
        .delete()
        .where({
          table_id: tableId,
          user_id: collaboratorUser.id,
        })
        // it should not delete owner
        .andWhereNot('role', 'owner')
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
