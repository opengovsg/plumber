import type { IStep } from '@plumber/types'

// Mirrors DEFAULT_SEND_MODE in packages/backend/src/apps/postman/common/parameters.ts.
const DEFAULT_SEND_MODE = 'combined'

type StepLike = Pick<IStep, 'appKey' | 'key' | 'parameters'>

function getSendMode(step: StepLike | undefined): string | undefined {
  if (step?.appKey !== 'postman' || step.key !== 'sendTransactionalEmail') {
    return undefined
  }
  const sendMode = step.parameters?.sendMode
  return typeof sendMode === 'string' ? sendMode : DEFAULT_SEND_MODE
}

/**
 * Compares a Postman send-email step before and after a save. A step that was
 * not yet a Postman step showed the default in the editor.
 */
export function getSendModeChange(
  previous: StepLike | undefined,
  saved: StepLike,
): { from: string; to: string } | null {
  const from = getSendMode(previous) ?? DEFAULT_SEND_MODE
  const to = getSendMode(saved)
  return to && from !== to ? { from, to } : null
}

/** Step timestamps arrive as epoch-millisecond strings. */
export function toIsoTimestamp(
  epochMs: string | undefined,
): string | undefined {
  const millis = parseInt(epochMs ?? '', 10)
  return Number.isNaN(millis) ? undefined : new Date(millis).toISOString()
}
