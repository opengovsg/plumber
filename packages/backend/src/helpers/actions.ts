import { IJSONObject } from '@plumber/types'

import { UnrecoverableError } from 'bullmq'
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

export function handleErrorAndThrow(errorDetails: IJSONObject): void {
  //
  // Retriable errors.
  //
  const errorString = errorDetails?.error as string
  if (!errorString) {
    throw new UnrecoverableError(JSON.stringify(errorDetails))
  }
  const isConnectivityIssue = CONNECTIVITY_ERROR_SIGNS.some((errorSign) =>
    errorString.includes(errorSign),
  )
  if (!isConnectivityIssue) {
    throw new UnrecoverableError(JSON.stringify(errorDetails))
  }

  throw new Error(JSON.stringify(errorDetails))
}
