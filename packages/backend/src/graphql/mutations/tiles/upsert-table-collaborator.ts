import { ITableCollabRole } from '@plumber/types'

import { BadUserInputError } from '@/errors/graphql-errors'
import { getOrCreateUser } from '@/helpers/auth'
import { validateAndParseEmail } from '@/helpers/email-validator'
import logger from '@/helpers/logger'
import TableCollaborator from '@/models/table-collaborators'
import User from '@/models/user'

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

    let collaboratorUser: User

    if (role === 'owner') {
      /**
       * If transferring ownership, current user must be owner
       * and new user must exist
       */
      await TableCollaborator.hasAccess(
        context.currentUser.id,
        tableId,
        'owner',
      )
      collaboratorUser = await User.query().findOne({ email })
      if (!collaboratorUser) {
        throw new BadUserInputError(
          'User not found. You can only transfer to users who have logged in at least once.',
        )
      }
    } else {
      /**
       * If mere adding collaborator, current user be editor
       * and new user will be created if not exists
       */
      await TableCollaborator.hasAccess(
        context.currentUser.id,
        tableId,
        'editor',
      )
      collaboratorUser = await getOrCreateUser(validatedEmail)
      if (!collaboratorUser) {
        throw new BadUserInputError('Error creating user')
      }
    }

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
        /**
         * Upsert collaborator here
         */
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

        /**
         * When transferring ownership, we need to make sure the current owner is set to editor
         */
        if (role === 'owner') {
          await TableCollaborator.query(trx)
            .where({ table_id: tableId, user_id: context.currentUser.id })
            .update({
              role: 'editor',
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
      throw new Error(e.message ?? 'Failed to upsert collaborator')
    }

    return true
  }

export default upsertTableCollaborator
