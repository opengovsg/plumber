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

    const validatedEmail = await validateAndParseEmail(email)
    if (!validatedEmail) {
      throw new BadUserInputError('Invalid collaborator email')
    }

    if (context.currentUser.email === validatedEmail) {
      throw new BadUserInputError('Cannot change own role')
    }

    if (role === 'owner') {
      throw new BadUserInputError('Cannot set collaborator role as owner')
    }

    await TableCollaborator.hasAccess(context.currentUser.id, tableId, 'editor')

    const collaboratorUser = await getOrCreateUser(validatedEmail)

    try {
      /**
       * We check if a table collaborator has been added before (could have been soft deleted)
       * If it exists, we update the role and undelete it (if it was soft deleted)
       * If it doesn't exist, we insert a new record
       */
      await TableCollaborator.transaction(async (trx) => {
        const existingCollaborator = await TableCollaborator.query(trx)
          .findOne({
            table_id: tableId,
            user_id: collaboratorUser.id,
          })
          .withSoftDeleted()
        if (existingCollaborator) {
          if (existingCollaborator.role === 'owner') {
            throw new BadUserInputError('Cannot change owner role')
          }
          await existingCollaborator
            .$query(trx)
            .patchAndFetch({
              role,
              deletedAt: null,
            })
            .withSoftDeleted()
        } else {
          await TableCollaborator.query(trx).insert({
            tableId,
            userId: collaboratorUser.id,
            role,
          })
        }
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
        error: e,
      })
      throw new Error('Failed to upsert collaborator')
    }

    return true
  }

export default upsertTableCollaborator
