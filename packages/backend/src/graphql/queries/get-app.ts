import App from '@/models/app'

import type { QueryResolvers } from '../__generated__/types.generated'

const getApp: QueryResolvers['getApp'] = async (_parent, params, context) => {
  const app = await App.findOneByKey(params.key)

  if (!context.currentUser) {
    return app
  }

  if (app.auth?.connectionType === 'system-added') {
    const connections = await app.auth.getSystemAddedConnections(
      context.currentUser,
    )

    return {
      ...app,
      connections,
    }
  }

  if (app.auth?.connectionType === 'user-added') {
    const connections = await context.currentUser
      .$relatedQuery('connections')
      .select('connections.*')
      .fullOuterJoinRelated('steps')
      .where({
        'connections.key': params.key,
        'connections.draft': false,
      })
      .countDistinct('steps.flow_id as flowCount')
      .groupBy('connections.id')
      .orderBy('created_at', 'desc')

    return {
      ...app,
      connections,
    }
  }

  return app
}

export default getApp
