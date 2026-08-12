import { IGlobalVariable } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error/v3'

import { AuthData, validateAuthData } from './auth-data'
import { verifyApiKey } from './verify-api-key'

const verifyCredentials = async ($: IGlobalVariable) => {
  try {
    const authData: AuthData = validateAuthData($)
    await verifyApiKey($)
    await $.auth.set({
      screenName: authData.screenName,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      // Auth data validation failed: throws message from first error
      throw new Error(fromZodError(error).details[0].message)
    }
    throw error
  }
}

export default verifyCredentials
