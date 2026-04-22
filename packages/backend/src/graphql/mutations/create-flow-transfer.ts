import FlowTransfer from '@/models/flow-transfers'
import TableCollaborator from '@/models/table-collaborators'
import TableMetadata from '@/models/table-metadata'
import User from '@/models/user'

import type { MutationResolvers } from '../__generated__/types.generated'

const createFlowTransfer: MutationResolvers['createFlowTransfer'] = async (
  _parent,
  params,
  context,
) => {
  const { flowId, newOwnerEmail } = params.input

  // check if flow belongs to the old owner first
  const flow = await context.currentUser
    .$relatedQuery('flows')
    .withGraphFetched('steps')
    .where('id', flowId)
    .throwIfNotFound('This pipe does not belong to you.')

  const newOwner = await User.query()
    .findOne({
      email: newOwnerEmail,
    })
    .throwIfNotFound({
      message:
        'User email does not exist on Plumber, please type in an email account of a user who has logged in before.',
    })

  // don't allow transferring of pipe to oneself
  if (context.currentUser.id === newOwner.id) {
    throw new Error(
      'You cannot transfer the pipe to yourself, please type in another email.',
    )
  }

  // Sanity check for existing pending transfer to avoid duplicates
  const hasExistingTransfer: boolean =
    (await FlowTransfer.query()
      .findOne({
        flow_id: flowId,
        old_owner_id: context.currentUser.id,
        new_owner_id: newOwner.id,
        status: 'pending',
      })
      .resultSize()) === 1

  if (hasExistingTransfer) {
    throw new Error(
      'Transfer has already been made. Please get the new owner to approve it.',
    )
  }

  // COLLABORATORS:
  // check that the current owner has the rights to make the new owner
  // an editor of the Tile (if any)
  // Filter out steps that do not have a tile selected as this will break
  const tilesSteps =
    flow?.[0].steps?.filter(
      (step) => step.appKey === 'tiles' && step.parameters?.tableId,
    ) ?? []

  // Filter out deleted tables before checking permissions
  const tableIds = tilesSteps.map((step) => step.parameters.tableId as string)
  const existingTableIds = new Set<string>()

  if (tableIds.length > 0) {
    const existingTables = await TableMetadata.query()
      .select('id')
      .whereIn('id', tableIds)

    existingTables.forEach((table) => {
      existingTableIds.add(table.id)
    })
  }

  // check that the current owner has the rights to make the new owner
  // an editor of all the Tiles in the Pipe (only for existing tables)
  await Promise.all(
    tilesSteps
      .filter((step) => existingTableIds.has(step.parameters.tableId as string))
      .map(async (step) => {
        await TableCollaborator.hasAccess(
          context.currentUser.id,
          step.parameters.tableId as string,
          'editor',
        )
      }),
  )

  const newTransfer: FlowTransfer = await context.currentUser
    .$relatedQuery('sentFlowTransfers')
    .insert({
      flowId,
      oldOwnerId: context.currentUser.id,
      newOwnerId: newOwner.id,
    })
  return newTransfer
}

export default createFlowTransfer
