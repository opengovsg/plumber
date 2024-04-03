import { IFlowTransferStatus } from '@plumber/types'

import logger from '@/helpers/logger'
import Flow from '@/models/flow'
import FlowTransfer from '@/models/flow-transfers'
import Step from '@/models/step'
import Context from '@/types/express/context'

type Params = {
  input: {
    id: string
    status: IFlowTransferStatus
    newOwnerId: string
  }
}

/**
 * Note that this mutation does two things
 * 1. Cancel/reject a flow transfer
 * 2. Approve a flow transfer AND update flow owner id as a single transaction
 */

const updateFlowTransferStatus = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  // TODO (mal): check if need to stop possible exploits
  const { id, status, newOwnerId } = params.input

  if (status === 'pending') {
    throw new Error('No updating of pipe transfer back to pending')
  }

  const flowTransfer = await FlowTransfer.query()
    .findOne({
      id,
    })
    .withGraphFetched({
      newOwner: true,
    })
    .throwIfNotFound()

  // To prevent possible exploits: for approved/rejected status: check if new owner matches
  if (
    (status === 'approved' || status === 'rejected') &&
    flowTransfer.newOwnerId !== newOwnerId
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
   * This transaction does 3 things to complete a flow transfer
   * 1. Nullify all the connections in the flow (phase 1)
   * 2. Update the flow id to the new owner
   * 3. Update the flow transfer status to 'approved'
   */
  return await FlowTransfer.transaction(async (trx) => {
    // logging for recovery purposes
    const connectionIds: string[] = []
    const stepIds: string[] = []
    flow.steps.forEach((step) => {
      if (step.connectionId) {
        stepIds.push(step.id)
        connectionIds.push(step.connectionId)
      }
    })

    logger.info('Flow transfer details', {
      event: 'flow-transfer-request',
      flowId: id,
      connectionIds,
      stepIds,
    })

    // nullify connections: both the connection and connectionId references
    const numNullified = await Step.query(trx)
      .patch({ connection: null, connectionId: null })
      .where('flow_id', flow.id)
      .whereNotNull('connection_id')

    // sanity check that only the connections belonging to the flow is nullified
    if (numNullified !== connectionIds.length) {
      throw new Error(
        'Update query went wrong, please contact plumber@open.gov.sg for more support',
      )
    }

    // update to new owner id
    await flow.$query(trx).patchAndFetch({
      userId: context.currentUser.id,
    })

    return await flowTransfer.$query(trx).patchAndFetch({
      status,
    })
  })
}

export default updateFlowTransferStatus
