import { memoize } from 'lodash'

import App from '@/models/app'

// Memoize as we can't use top-level awaits yet.
const getFileProcessingActions = memoize(
  async (): Promise<ReadonlyMap<string, ReadonlySet<string>>> => {
    const result = new Map<string, Set<string>>()
    const apps = await App.findAll()

    for (const app of apps) {
      for (const action of app.actions ?? []) {
        if (action.doesFileProcessing ?? false) {
          if (!result.has(app.key)) {
            result.set(app.key, new Set([action.key]))
          } else {
            result.get(app.key).add(action.key)
          }
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

  const fileProcessingActions = await getFileProcessingActions()
  return fileProcessingActions.get(appKey)?.has(actionKey) ?? false
}
