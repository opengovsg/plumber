import type { IJSONObject } from '@plumber/types'
import type { Transaction } from 'objection'

import FlowConnections from '@/models/flow-connections'

import { APP_CONNECTION_FIELDS } from './get-shared-connection-details'

/**
 * Non-owners use editorReadOnly apps with the owner's identity, so they may
 * only pick values the owner shared with the flow (e.g. M365 Excel files).
 */
export async function isConnectionFieldSharedWithFlow({
  flowId,
  appKey,
  connectionId,
  parameters,
  trx,
}: {
  flowId: string
  appKey: string | null | undefined
  connectionId: string | null | undefined
  parameters: IJSONObject | null | undefined
  trx?: Transaction
}): Promise<boolean> {
  const connectionField = appKey ? APP_CONNECTION_FIELDS[appKey] : undefined
  const parameterKey = connectionField?.parameterKey
  if (
    connectionField?.editorReadOnly !== true ||
    !parameterKey ||
    !connectionId
  ) {
    return true
  }

  const value = parameters?.[parameterKey]
  if (value === undefined || value === null || value === '') {
    return true
  }

  const sharedValues = await FlowConnections.getSharedParameterValues({
    flowId,
    connectionId,
    parameterKey,
    trx,
  })
  return typeof value === 'string' && sharedValues?.includes(value) === true
}
