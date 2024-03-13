import type { IGlobalVariable } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { validateAuthData } from './auth-data'
import { verifyApiKey } from './verify-api-key'

export default async function isStillVerified(
  $: IGlobalVariable,
): Promise<boolean> {
  try {
    validateAuthData($)
    await verifyApiKey($)
    return true
  } catch (error) {
    if (error instanceof ZodError) {
      // Auth data validation failed: throws message from first error
      throw new Error(fromZodError(error).details[0].message)
    }
    throw error
  }
}
