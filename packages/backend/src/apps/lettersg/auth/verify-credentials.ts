import type { IGlobalVariable } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import {
  getEnvironmentFromApiKey,
  LETTERSG_STAGING_LABEL_SUFFIX,
  LetterSgEnvironment,
} from '../common/api'

import { AuthData, validateAuthData } from './auth-data'
import { verifyApiKey } from './verify-api-key'

export default async function verifyCredentials(
  $: IGlobalVariable,
): Promise<void> {
  try {
    const authData: AuthData = validateAuthData($)
    const env = getEnvironmentFromApiKey(authData.apiKey)
    const isStaging = env === LetterSgEnvironment.Staging
    const baseScreenName = authData.screenName.endsWith(
      LETTERSG_STAGING_LABEL_SUFFIX,
    )
      ? authData.screenName.slice(0, -LETTERSG_STAGING_LABEL_SUFFIX.length)
      : authData.screenName

    await verifyApiKey($)

    // update label
    await $.auth.set({
      screenName: isStaging
        ? `${baseScreenName}${LETTERSG_STAGING_LABEL_SUFFIX}`
        : baseScreenName,
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
