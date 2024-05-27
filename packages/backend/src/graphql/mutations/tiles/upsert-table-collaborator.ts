import { ITableCollabRole } from '@plumber/types'

import { BadUserInputError } from '@/errors/graphql-errors'
import { getOrCreateUser } from '@/helpers/auth'
import { validateAndParseEmail } from '@/helpers/email-validator'
import logger from '@/helpers/logger'
import TableCollaborator from '@/models/table-collaborators'

import type { MutationResolvers } from '../../__generated__/types.generated'

const upsertTableCollaborator: MutationResolvers['upsertTableCollaborator'] =
  async (_parent, params, context) => {
    const { tableId, email, role } = params.input as {
      tableId: string
      email: string
      role: ITableCollabRole
    }

    await TableCollaborator.hasAccess(context.currentUser.id, tableId, 'editor')

    const validatedEmail = await validateAndParseEmail(email)

    if (!validatedEmail) {
      throw new BadUserInputError('Invalid collaborator email')
    }

    const collaboratorUser = await getOrCreateUser(validatedEmail)

    try {
      await TableCollaborator.query()
        .insert({
          tableId,
          userId: collaboratorUser.id,
          role,
        })
        .onConflict(['tableId', 'userId'])
        .update({
          role,
        })
    } catch (e) {
      logger.error({
        message: 'Failed to upsert collaborator',
        data: {
          tableId,
          email,
          role,
        },
        userId: context.currentUser.id,
      })
      throw new Error('Failed to upsert collaborator')
    }

    return true
  }

export default upsertTableCollaborator
