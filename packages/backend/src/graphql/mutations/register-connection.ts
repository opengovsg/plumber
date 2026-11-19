import { NotFoundError } from 'objection'

import apps from '@/apps'
import { ForbiddenError } from '@/errors/graphql-errors'
import Flow from '@/models/flow'
import { loadAccessibleFlow } from '@/services/access'
import {
  getConnection,
  isForeignPersonalConnection,
} from '@/services/connection'
import { registerConnectionForFlow } from '@/services/connection-registration'

import type { MutationResolvers } from '../__generated__/types.generated'

const registerConnection: MutationResolvers['registerConnection'] = async (
  _parent,
  params,
  context,
) => {
  const { connectionId, flowId } = params.input
  if (!flowId) {
    throw new NotFoundError({ modelClass: Flow })
  }

  const flow = await loadAccessibleFlow({
    user: context.currentUser,
    flowId,
    role: 'editor',
  })

  if (!flow) {
    throw new NotFoundError({ modelClass: Flow })
  }

  const connection = await getConnection({
    user: context.currentUser,
    connectionId,
    flowId,
    includeOwnConnections: flow.role === 'owner',
  })

  if (isForeignPersonalConnection(connection, context.currentUser.id)) {
    throw new ForbiddenError(
      'You cannot register a personal connection that you do not own',
    )
  }

  const app = apps[connection.key]
  if (!app) {
    throw new Error('Invalid app')
  }

  const result = await registerConnectionForFlow({
    user: context.currentUser,
    app,
    connection,
    flow,
  })

  if (result === 'unsupported') {
    throw new Error('App does not support connection registration.')
  }

  if (result === 'unverified') {
    throw new Error('Connection is not verified')
  }

  return true
}

export default registerConnection
