import { IJSONObject } from '@plumber/types'

import { UnrecoverableError } from 'bullmq'
import { get, memoize } from 'lodash'

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
const CONNECTIVITY_STATUS_CODE = [504]

export function handleErrorAndThrow(errorDetails: IJSONObject): never {
  const errorString = get(errorDetails, 'details.error', '') as string
  const statusCode = Number(get(errorDetails, 'status', 0))
  if (!errorString && !statusCode) {
    throw new UnrecoverableError(JSON.stringify(errorDetails))
  }

  // Certain connectivity errors can be retried.
  const isConnectivityIssue =
    CONNECTIVITY_ERROR_SIGNS.some((errorSign) =>
      errorString.includes(errorSign),
    ) || CONNECTIVITY_STATUS_CODE.includes(statusCode)
  if (isConnectivityIssue) {
    throw new Error(JSON.stringify(errorDetails))
  }

  // All other errors cannot be retried.
  throw new UnrecoverableError(JSON.stringify(errorDetails))
}
