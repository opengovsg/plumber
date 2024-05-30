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

    const validatedEmail = await validateAndParseEmail(email)
    if (!validatedEmail) {
      throw new BadUserInputError('Invalid collaborator email')
    }

    if (validatedEmail === context.currentUser.email) {
      throw new BadUserInputError('Cannot remove yourself')
    }

    await TableCollaborator.hasAccess(context.currentUser.id, tableId, 'editor')

    const user = await User.query()
      .findOne({
        email: validatedEmail,
      })
      .throwIfNotFound('No such user found')

    const collaboratorUser = await TableCollaborator.query()
      .findOne({
        table_id: tableId,
        user_id: user.id,
      })
      .throwIfNotFound('No such collaborator found')

    if (collaboratorUser.role === 'owner') {
      throw new BadUserInputError('Cannot remove owner')
    }

    try {
      await collaboratorUser.$query().delete()
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
