import { IStep } from '@plumber/types'

import { Transaction } from 'objection'

import FlowCollaborator from '@/models/flow-collaborators'
import FlowConnections from '@/models/flow-connections'
import TableCollaborator from '@/models/table-collaborators'

import { APP_CONNECTION_FIELDS } from './get-shared-connection-details'

interface AddFlowConnectionParams {
  step: IStep
  addedBy: string
  trx?: Transaction
}

interface AddTableFlowConnectionParams {
  flowId: string
  tableId: string
  addedBy: string
  flowOwnerId: string
  trx?: Transaction
}

async function addFlowConnection({
  step,
  addedBy,
  trx,
}: AddFlowConnectionParams): Promise<void> {
  const { appKey, flowId, connectionId } = step

  if (!connectionId) {
    throw new Error(`Step ${step.id} has no connection to add`)
  }

  const parameterKey = appKey
    ? APP_CONNECTION_FIELDS[appKey]?.parameterKey
    : undefined
  const parameterValue = parameterKey
    ? step.parameters?.[parameterKey]
    : undefined

  // only flow connections with a parameterKey specified need to have
  // its metadata updated with the parameter value
  if (parameterKey && parameterValue) {
    await FlowConnections.patchFlowConnectionMetadata({
      flowId,
      connectionId,
      parameterKey,
      parameterValue: parameterValue as string,
      addedBy,
      trx,
    })
  } else {
    await FlowConnections.addFlowConnection({
      flowId,
      connectionId,
      addedBy,
      connectionType: 'connection',
      trx,
    })
  }
}

/**
 * NOTE: we automatically add the collaborator as a collaborator to the Tile(s)
 * this ensures that the Tile appears in the dropdown when they are working
 * on the flow
 */
async function addFlowTableConnection({
  flowId,
  tableId,
  addedBy,
  flowOwnerId,
  trx,
}: AddTableFlowConnectionParams): Promise<void> {
  // COLLABORATORS:
  // check that the user is already an Owner / Editor of the Tile first
  // otherwise they should not be allowed to add a new collaborator
  await TableCollaborator.hasAccess(addedBy, tableId, 'editor')

  // first try to add the connection to the flow_connections table
  await FlowConnections.addFlowConnection({
    flowId,
    connectionId: tableId,
    addedBy,
    connectionType: 'table',
    trx,
  })

  // then add the collaborators to the flow_collaborators table
  const collaborators = await FlowCollaborator.getCollaborators({
    flowId,
    trx,
  })

  // now that editors can also add their own tiles, we also need to add the flow owner
  // as an editor to the tile
  // if the addedBy === flowOwnerId, the owner is adding their own Tile so we can skip this
  if (addedBy !== flowOwnerId) {
    await TableCollaborator.upgradeOrInsertCollaborator({
      userId: flowOwnerId,
      tableId,
      role: 'editor',
      trx,
    })
  }

  // use Promise.all so that we use the addCollaborator function, which checks
  // if the collaborator already exists to avoid duplicates
  await Promise.all(
    collaborators.map(async ({ userId, role }) => {
      await TableCollaborator.upgradeOrInsertCollaborator({
        userId,
        tableId,
        role,
        trx,
      })
    }),
  )
}

export { addFlowConnection, addFlowTableConnection }
