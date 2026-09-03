import type { IAction, IJSONObject, IJSONValue, ITrigger } from '@plumber/types'

import apps from '@/apps'

import { REDACTED } from './sensitive-keys'

export function isJsonObject(value: unknown): value is IJSONObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function findTriggerOrAction(
  appKey: string,
  key: string,
): ITrigger | IAction | undefined {
  const app = apps[appKey]
  if (!app) {
    return undefined
  }

  return (
    app.triggers?.find((trigger) => trigger.key === key) ??
    app.actions?.find((action) => action.key === key)
  )
}

/**
 * Hands one step's parameters to the app that owns them.
 *
 * Indexes the apps record directly, because morgan's tokens are synchronous.
 */
export function redactStepParameters(node: IJSONValue): IJSONValue {
  if (!isJsonObject(node)) {
    return node
  }

  const { appKey, parameters } = node
  if (typeof appKey !== 'string' || !isJsonObject(parameters)) {
    return node
  }

  // dynamicAction spends `key` on the dynamic action, so it names the step separately.
  const stepKey = node.stepKey ?? node.key
  if (typeof stepKey !== 'string') {
    return node
  }

  const redactParams = findTriggerOrAction(appKey, stepKey)?.redactParams
  if (!redactParams) {
    return node
  }

  try {
    return { ...node, parameters: redactParams(parameters) }
  } catch {
    // A half-redacted result cannot be trusted, so drop the whole object.
    return { ...node, parameters: REDACTED }
  }
}
