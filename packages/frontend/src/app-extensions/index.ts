import type { FrontEndAppExtension } from './types'

// Nothing for now
const APP_EXTENSIONS: Record<string, FrontEndAppExtension> = {}

export function getExtension(
  appKey?: string,
  stepKey?: string,
): FrontEndAppExtension | null {
  if (!appKey || !stepKey) {
    return null
  }
  return APP_EXTENSIONS[`${appKey}-${stepKey}`] ?? null
}

export type {
  CheckStepButtonExtensionProps,
  FrontEndAppExtension,
} from './types'
