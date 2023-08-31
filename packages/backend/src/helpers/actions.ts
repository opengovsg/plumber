import { type IAction } from '@plumber/types'

import { memoize } from 'lodash'

import App from '@/models/app'

function getCompositeKey(appKey: string, actionKey: string): string {
  return `${appKey}:${actionKey}`
}

// Memoize as we can't use top-level awaits yet.
const getFileProcessingActions = memoize(
  async (): Promise<ReadonlySet<string>> => {
    const result = new Set<string>()
    const apps = await App.getAllAppsWithFunctions()

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

// Memoize since we can't use top-level await yet. Returns a map of composite
// app-action key to the action's on-publish hook.
const getAllOnPublishHooks = memoize(
  async (): Promise<
    ReadonlyMap<string, NonNullable<IAction['onPipePublish']>>
  > => {
    const result = new Map<string, NonNullable<IAction['onPipePublish']>>()
    const apps = await App.getAllAppsWithFunctions()

    for (const app of apps) {
      for (const action of app.actions ?? []) {
        if (action.onPipePublish) {
          result.set(getCompositeKey(app.key, action.key), action.onPipePublish)
        }
      }
    }

    return result
  },
)

export async function getOnPipePublishHook(
  appKey: string,
  actionKey: string,
): Promise<IAction['onPipePublish'] | null> {
  const allHooks = await getAllOnPublishHooks()
  return allHooks.get(getCompositeKey(appKey, actionKey)) ?? null
}
