import { IFlowCollabRole } from '@plumber/types'

import { BadUserInputError } from '@/errors/graphql-errors'
import { getOrCreateUser } from '@/helpers/auth'
import { validateAndParseEmail } from '@/helpers/email-validator'
import logger from '@/helpers/logger'
import FlowCollaborator from '@/models/flow-collaborators'

import type { MutationResolvers } from '../__generated__/types.generated'

const upsertFlowCollaborator: MutationResolvers['upsertFlowCollaborator'] =
  async (_parent, params, context) => {
    const { flowId, email, role } = params.input as {
      flowId: string
      email: string
      role: IFlowCollabRole
    }

    const validatedEmail = await validateAndParseEmail(email)
    if (!validatedEmail) {
      throw new BadUserInputError('Invalid collaborator email')
    }

    if (context.currentUser.email === validatedEmail) {
      throw new BadUserInputError('Cannot change own role')
    }

    try {
      /**
       * We check if a flow collaborator has been added before (could have been soft deleted)
       * and if so, we update the role
       */
      await FlowCollaborator.transaction(async (trx) => {
        /**
         * this mutation only allows for adding / updating collaborators.
         * flow transfer is still handled by the updateFlowTransferStatus mutation.
         * new user will be created if not exists
         */
        await FlowCollaborator.hasAccess({
          userId: context.currentUser.id,
          flowId,
          requiredRole: 'editor',
          trx,
        })

        const collaboratorUser = await getOrCreateUser(validatedEmail)
        if (!collaboratorUser) {
          throw new BadUserInputError('Error creating user')
        }

        const existingCollaborator = await FlowCollaborator.query(trx)
          .findOne({
            flow_id: flowId,
            user_id: collaboratorUser.id,
          })
          .withSoftDeleted()

        if (existingCollaborator) {
          await existingCollaborator
            .$query(trx)
            .patchAndFetch({
              role,
              deletedAt: null,
              updatedBy: context.currentUser.id,
            })
            .withSoftDeleted()
        } else {
          await FlowCollaborator.query(trx).insert({
            flowId,
            userId: collaboratorUser.id,
            role,
            updatedBy: context.currentUser.id,
          })
        }
      })
    } catch (error) {
      logger.error({
        message: 'Error upserting flow collaborator',
        data: {
          flowId,
          email,
          role,
        },
        userId: context.currentUser.id,
        error,
      })
      throw new Error(error.message ?? 'Error upserting flow collaborator')
    }

    return true
  }

export default upsertFlowCollaborator
