import type { IJSONObject } from '@plumber/types'

import { createVersionedStepTransformer } from '@/helpers/transform-step-parameters'

import { SEND_MODE_KEY, SendMode } from './parameters'

/**
 * sendTransactionalEmail (v1 → v2): pin the legacy send mode.
 *
 * Steps created before the send-mode toggle existed always sent one email per
 * recipient. Writing that explicitly keeps them on it, while steps created at
 * v2 without the key default to the new combined mode. Idempotent.
 */
export function addLegacySendMode(parameters: IJSONObject): IJSONObject {
  if (parameters[SEND_MODE_KEY] !== undefined) {
    return parameters
  }
  return {
    ...parameters,
    [SEND_MODE_KEY]: 'individual' satisfies SendMode,
  }
}

const ACTION_TRANSFORMERS: Record<
  string,
  ((parameters: IJSONObject) => IJSONObject)[]
> = {
  sendTransactionalEmail: [addLegacySendMode],
}

export const stepTransformer =
  createVersionedStepTransformer(ACTION_TRANSFORMERS)
