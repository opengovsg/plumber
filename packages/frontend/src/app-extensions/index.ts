import formsgExtensions from './formsg'
import postmanExtensions from './postman'
import type { FrontEndAppExtension } from './types'

/**
 * Keys are `${appKey}-${stepKey}`.
 */
const APP_EXTENSIONS: Record<string, FrontEndAppExtension> = {
  ...postmanExtensions,
  ...formsgExtensions,
}

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
