import { IFlowCollabRole } from '@plumber/types'

import { BadUserInputError, ForbiddenError } from '@/errors/graphql-errors'
import { addFlowTableConnection } from '@/helpers/add-flow-connection'
import { getOrCreateUser } from '@/helpers/auth'
import { validateAndParseEmail } from '@/helpers/email-validator'
import { getConnectionDetails } from '@/helpers/get-shared-connection-details'
import { getLdFlagValue } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import FlowConnections from '@/models/flow-connections'

import type { MutationResolvers } from '../__generated__/types.generated'

const upsertFlowCollaborator: MutationResolvers['upsertFlowCollaborator'] =
  async (_parent, params, context) => {
    const { flowId, email, role } = params.input as {
      flowId: string
      email: string
      role: IFlowCollabRole
    }

    // TODO (kevinkim-ogp): remove this once collaborators is released to all
    const collaboratorsFlag = await getLdFlagValue(
      'collaborators',
      context.currentUser.email,
      false,
    )
    if (!collaboratorsFlag) {
      throw new ForbiddenError(' You are not allowed to add collaborators.')
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

        /**
         * NOTE: we only automatically add all connections
         * in the Pipe to the flow_connections table the first time
         * the Pipe is shared.
         *
         * What is added:
         * 1. Connections
         * 2. Connection metadata, i.e. fields that are like connections:
         *    see helpers/get-shared-connection-details.ts for more details
         */
        const hasCollaborators = await Flow.hasCollaborators({
          flowId,
          trx,
        })

        const flow = await Flow.query(trx)
          .withGraphFetched('steps')
          .findById(flowId)
        const connectionDetails = getConnectionDetails(flow?.steps)

        if (!hasCollaborators) {
          // add all connections to the flow_connections table
          // first time sharing is always by the owner
          // so we use the flow user_id
          const connectionInserts = Object.entries(
            connectionDetails.connection,
          ).map(([connectionId, metadata]) => ({
            flow_id: flowId,
            connection_id: connectionId,
            added_by: flow.userId,
            connection_type: 'connection' as const,
            metadata,
          }))

          if (connectionInserts.length > 0) {
            await trx
              .table('flow_connections')
              .insert(connectionInserts)
              .onConflict(['flow_id', 'connection_id'])
              .ignore()
          }
        }

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

        /**
         * use Promise.all so that we use the addFlowTableConnection function, which checks
         * if the collaborator already exists to avoid duplicates and adds the tile to
         * flow_connections at the same time
         */
        if (connectionDetails.table.length > 0) {
          await Promise.all(
            connectionDetails.table.map(async (tableId) => {
              await addFlowTableConnection({
                flowId,
                tableId,
                addedBy: context.currentUser.id,
                trx,
              })
            }),
          )
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
