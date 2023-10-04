import { IJSONObject } from '@plumber/types'

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

const CONNECTIVITY_ERROR_SIGNS = ['ETIMEDOUT', 'ECONNRESET']

export function isRetriableError(errorDetails: IJSONObject): boolean {
  // Connectivity error
  if (
    errorDetails.error &&
    CONNECTIVITY_ERROR_SIGNS.some((errorSign) =>
      (errorDetails.error as string).includes(errorSign),
    )
  ) {
    return true
  }

  return false
}
