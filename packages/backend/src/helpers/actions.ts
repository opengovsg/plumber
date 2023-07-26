import { memoize } from 'lodash'

import App from '@/models/app'

function getCompositeKey(appKey: string, actionKey: string): string {
  return `${appKey}_action_${actionKey}`
}

// Memoize as we can't use top-level awaits yet.
const getFileProcessingActions = memoize(
  async (): Promise<ReadonlySet<string>> => {
    const result = new Set<string>()
    const apps = await App.findAll()

    for (const app of apps) {
      for (const action of app.actions ?? []) {
        if (action.doesFileProcessing ?? false) {
          result.add(getCompositeKey(app.key, action.key))
        }
      }
    }

    return result
  },
)

export async function doesActionProcessFiles(
  appKey: string,
  actionKey: string,
): Promise<boolean> {
  if (!appKey || !actionKey) {
    return false
  }

  return (await getFileProcessingActions()).has(
    getCompositeKey(appKey, actionKey),
  )
}
