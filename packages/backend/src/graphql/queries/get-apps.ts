import App from '@/models/app'

import type { QueryResolvers } from '../__generated__/types.generated'

const getApps: QueryResolvers['getApps'] = async (_parent, params) => {
  const apps = await App.findAll(params.name)

  if (params.onlyWithTriggers) {
    return apps.filter((app) => app.triggers?.length)
  }

  if (params.onlyWithActions) {
    return apps.filter((app) => app.actions?.length)
  }

  return apps
}

export default getApps
