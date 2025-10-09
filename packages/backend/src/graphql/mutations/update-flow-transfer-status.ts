import { BadUserInputError } from '@/errors/graphql-errors'
import { getConnectionDetails } from '@/helpers/get-shared-connection-details'
import logger from '@/helpers/logger'
import Connection from '@/models/connection'
import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import FlowConnections from '@/models/flow-connections'
import FlowTransfer from '@/models/flow-transfers'
import Step from '@/models/step'
import TableCollaborator from '@/models/table-collaborators'

import type { MutationResolvers } from '../__generated__/types.generated'

/**
 * Note that this mutation does two things
 * 1. Cancel/reject a flow transfer
 * 2. Approve a flow transfer AND update flow owner id as a single transaction
 */

const updateFlowTransferStatus: MutationResolvers['updateFlowTransferStatus'] =
  async (_parent, params, context) => {
    const { id, status } = params.input

    if (status === 'pending') {
      throw new Error('No updating of pipe transfer back to pending')
    }

    const flowTransfer = await FlowTransfer.query()
      .findOne({ id })
      .withGraphFetched({ newOwner: true })
      .throwIfNotFound()

    // To prevent possible exploits: for approved/rejected status: check if new owner matches
    if (
      (status === 'approved' || status === 'rejected') &&
      flowTransfer.newOwnerId !== context.currentUser.id
    ) {
      throw new Error('Pipe transfer request does not belong to new owner')
    }

    // for cancelled status: check if old owner matches
    if (
      status === 'cancelled' &&
      flowTransfer.oldOwnerId !== context.currentUser.id
    ) {
      throw new Error('Pipe transfer request does not belong to old owner')
    }

    if (status === 'rejected' || status === 'cancelled') {
      return await flowTransfer.$query().patchAndFetch({
        status,
      })
    }

    // Approval flow: only fetch flow here instead of doing it above unnecessarily
    const flow = await Flow.query()
      .findOne({
        id: flowTransfer.flowId,
      })
      .withGraphFetched({
        steps: {
          connection: true,
        },
      })
      .throwIfNotFound('Pipe to be transferred cannot be found')

    /**
     * This transaction does the following to complete a flow transfer:
     * - Duplicate all connections in the connections table and nullify the user ids
     *   (EXCEPT M365-excel: nullify all connections)
     * - Patch the steps to reference the duplicate connection(s)
     * - Share all connections and tables to flow_connections (if not already shared)
     * - Add the new owner as an editor in the table (if not already an editor)
     * - Update the flow id to the new owner
     * - Update the flow transfer status to 'approved'
     */
    return await FlowTransfer.transaction(async (trx) => {
      // logging for recovery purposes
      const connectionIds: string[] = []
      const tableIds: string[] = []
      const stepIds: string[] = []
      flow.steps.forEach((step) => {
        if (step.connectionId) {
          stepIds.push(step.id)
          connectionIds.push(step.connectionId)
        }
        if (step.parameters.tableId) {
          tableIds.push(step.parameters.tableId as string)
        }
      })

      logger.info('Flow transfer details', {
        event: 'flow-transfer-request',
        flowTransferId: id,
        flowId: flow.id,
        connectionIds,
        tableIds,
        stepIds,
      })

      // PRE-TRANSFER WORK
      // nullify connections for M365-excel
      // excel connections cannot be shared; the new owner should use their own connection
      const numExcelNullified = await Step.query(trx)
        .patch({ connection: null, connectionId: null, status: 'incomplete' })
        .where('flow_id', flow.id)
        .whereNotNull('connection_id')
        .andWhere('app_key', 'm365-excel')

      // sanity check that only the connections belonging to the flow is nullified
      if (numExcelNullified > flow.steps.length) {
        throw new Error(
          'Update query went wrong, please contact plumber@open.gov.sg for more support',
        )
      }

      // set tiles actions to incomplete
      const numIncompleteForTiles = await Step.query(trx)
        .patch({ status: 'incomplete' })
        .where('flow_id', flow.id)
        .andWhere('app_key', 'tiles')

      // sanity check
      if (numIncompleteForTiles > flow.steps.length) {
        throw new Error(
          'Update tiles status query went wrong, please contact plumber@open.gov.sg for more support',
        )
      }

      // HANDLE CONNECTIONS
      // get the connections and tables to be shared
      // intentionally exclude m365-excel as the connection has been nullified
      // and it should retain the user_id in the connections table
      const connectionDetails = getConnectionDetails(
        flow?.steps.filter((step) => step.appKey !== 'm365-excel'),
      )
      const sharedConnections = connectionDetails.connection
      const sharedTables = connectionDetails.table

      if (Object.keys(sharedConnections).length > 0) {
        // duplicate the connections in the connections table and nullify the IDs
        await Promise.all(
          Object.entries(sharedConnections).map(
            async ([connectionId, metadata]) => {
              const duplicatedConnection = await Connection.duplicate(
                connectionId,
                trx,
              )

              if (duplicatedConnection) {
                const { id: newConnectionId } = duplicatedConnection
                const existingFlowConnection = await FlowConnections.query(
                  trx,
                ).findOne({
                  flow_id: flow.id,
                  connection_id: connectionId,
                })

                // update or create flow connection using the duplicated connection
                if (existingFlowConnection) {
                  await existingFlowConnection
                    .$query(trx)
                    .patchAndFetch({
                      connectionId: newConnectionId,
                    })
                    .where({
                      flow_id: flow.id,
                      connection_id: connectionId,
                    })
                } else {
                  await FlowConnections.query(trx).insertAndFetch({
                    flowId: flow.id,
                    connectionId: newConnectionId,
                    addedBy: flow.userId,
                    connectionType: 'connection',
                    metadata: metadata,
                  })
                }

                // patch the steps to reference the duplicate connection(s)
                await Step.query(trx)
                  .patch({ connectionId: newConnectionId })
                  .where('flow_id', flow.id)
                  .whereNotNull('connection_id')
                  .where('connection_id', connectionId)

                return {
                  flowId: flow.id,
                  connectionId: newConnectionId,
                  addedBy: flow.userId,
                  connectionType: 'connection',
                  metadata: metadata,
                }
              }
            },
          ),
        )
      }

      // HANDLE TABLES
      // table connections are not duplicated as the owner of the table stays the same
      // the new owner only becomes an editor of the table
      // if the table needs to be transferred, it should be done from the Tile
      if (sharedTables.length > 0) {
        const tableInserts = await Promise.all(
          sharedTables.map(async (tableId) => {
            try {
              // there may be instances where the new pipe owner is already the owner of the table
              // we catch the error but do nothing`
              await TableCollaborator.addCollaborator({
                userId: context.currentUser.id, // the new owner
                tableId,
                role: 'editor',
                trx,
              })
            } catch (e) {
              // do nothing if the new owner of the pipe is already the owner of the tile
              if (
                !(e instanceof BadUserInputError) &&
                e.message !== 'Cannot change owner role'
              ) {
                throw new Error(e)
              }
            }

            // always return the table
            return {
              flowId: flow.id,
              connectionId: tableId,
              addedBy: flow.userId,
              connectionType: 'table' as const,
            }
          }),
        )

        // add all tables to the flow_connections table
        await FlowConnections.query(trx)
          .insert(tableInserts)
          .onConflict(['flow_id', 'connection_id'])
          .ignore()
      }

      // HANDLE FLOW COLLABORATORS
      // - check if the current owner was once a collaborator
      // - update the role if they were a collaborator
      // - otherwise, create a new record
      const existingCollaborator = await FlowCollaborator.query(trx)
        .findOne({
          flow_id: flow.id,
          user_id: flow.userId,
        })
        .withSoftDeleted()

      if (!existingCollaborator) {
        await FlowCollaborator.query(trx).insert({
          flowId: flow.id,
          userId: flow.userId,
          role: 'editor',
          updatedBy: context.currentUser.id,
        })
      } else {
        await existingCollaborator.$query(trx).patchAndFetch({
          role: 'editor',
          deletedAt: null,
          updatedBy: context.currentUser.id,
        })
      }

      // remove the new owner from the flow collaborators
      const isNewOwnerCollaborator = await FlowCollaborator.query(trx).findOne({
        flow_id: flow.id,
        user_id: context.currentUser.id,
      })

      if (isNewOwnerCollaborator) {
        await FlowCollaborator.deleteCollaborator({
          userId: context.currentUser.id,
          flowId: flow.id,
          trx,
        })
      }

      // make the current owner a collaborator in the flow
      await FlowCollaborator.upsertCollaborator({
        userId: flow.userId,
        flowId: flow.id,
        role: 'editor',
        updatedBy: context.currentUser.id,
        trx,
      })

      // update the flow owner id
      await flow.$query(trx).patchAndFetch({ userId: context.currentUser.id })

      // FINALLY, MARK THE FLOW TRANSFER AS APPROVED AND COMPLETED
      return await flowTransfer.$query(trx).patchAndFetch({
        status,
      })
    })
  }

export default updateFlowTransferStatus
