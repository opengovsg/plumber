import type { IApp } from '@plumber/types'

import { memoize } from 'lodash'

import { ACTION_APPS_RANKING, TRIGGER_APPS_RANKING } from '@/apps'
import App from '@/models/app'

import type { QueryResolvers } from '../__generated__/types.generated'

const getSortedApps = memoize(
  async (): Promise<IApp[]> => {
    const apps = await App.findAll()

    console.log('no cache hit')
    // trade off for increased time complexity but easier to add a new app to the ranking
    return apps.sort((a, b) => {
      const firstPriority = a.triggers
        ? TRIGGER_APPS_RANKING.findIndex((app) => app === a.key)
        : ACTION_APPS_RANKING.findIndex((app) => app === a.key)
      const secondPriority = b.triggers
        ? TRIGGER_APPS_RANKING.findIndex((app) => app === b.key)
        : ACTION_APPS_RANKING.findIndex((app) => app === b.key)

      // sort by newApp flag, followed by priority
      if (a.isNewApp && b.isNewApp) {
        return firstPriority - secondPriority
      }
      if (a.isNewApp) {
        return -1
      }
      if (b.isNewApp) {
        return 1
      }
      return firstPriority - secondPriority
    })
  },
  () => 'getApps',
)

const getApps: QueryResolvers['getApps'] = async () => {
  console.time('getApps')
  const apps = await getSortedApps()
  console.timeEnd('getApps')
  return apps
}

export default getApps
