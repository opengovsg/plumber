import App from '@/models/app'

import type { QueryResolvers } from '../__generated__/types.generated'

const getConnectedApps: NonNullable<
  QueryResolvers['getConnectedApps']
> = async (_parent, params, context) => {
  let apps = await App.findAll(params.name)

  const connections = await context.currentUser
    .$relatedQuery('connections')
    .select('connections.key')
    .where({ draft: false })
    .count('connections.id as count')
    .groupBy('connections.key')

  const flows = await context.currentUser
    .$relatedQuery('flows')
    .withGraphJoined('steps')
    .orderBy('created_at', 'desc')

  const duplicatedUsedApps = flows
    .map((flow) => flow.steps.map((step) => step.appKey))
    .flat()
    .filter(Boolean)

  const connectionKeys = connections.map((connection) => connection.key)
  const usedApps = [...new Set([...duplicatedUsedApps, ...connectionKeys])]

  apps = apps
    .filter((app) => {
      return usedApps.includes(app.key)
    })
    .map((app) => {
      const connection = connections.find(
        (connection) => connection.key === app.key,
      )

      app.connectionCount = connection?.count || 0
      app.flowCount = 0

      flows.forEach((flow) => {
        const usedFlow = flow.steps.find((step) => step.appKey === app.key)

        if (usedFlow) {
          app.flowCount += 1
        }
      })

      return app
    })
    .sort((appA, appB) => appA.name.localeCompare(appB.name))

  return apps
}

export default getConnectedApps
