import type { IGlobalVariable } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { getEnvironmentFromApiKey, LetterSgEnvironment } from '../common/api'

import { AuthData, validateAuthData } from './auth-data'
import { verifyApiKey } from './verify-api-key'

export default async function verifyCredentials(
  $: IGlobalVariable,
): Promise<void> {
  try {
    const authData: AuthData = validateAuthData($)
    const env = getEnvironmentFromApiKey(authData.apiKey)

    // after validation, can only be a prod or staging API key
    const labelSuffix: string =
      env === LetterSgEnvironment.Staging ? ' [STAGING]' : ''
    await verifyApiKey($)

    // update label
    await $.auth.set({
      screenName: `${authData.screenName}${labelSuffix}`,
      env,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      // Auth data validation failed: throws message from first error
      throw new Error(fromZodError(error).details[0].message)
    }
    throw error
  }
}
