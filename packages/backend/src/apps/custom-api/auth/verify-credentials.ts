import { IGlobalVariable } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { validateAuthData } from './auth-data'

const verifyCredentials = async ($: IGlobalVariable) => {
  try {
    const authData = validateAuthData($)

    const stringifiedHeaders = authData.headers

    let headers: Record<string, string> = {}

    if (stringifiedHeaders) {
      headers = stringifiedHeaders
        .split('\n')
        // split by first '='
        .map((header) => header.trim().split('='))
        .reduce((acc, [key, ...value]) => {
          const trimmedKey = key.trim()
          const trimmedValue = value.join('=').trim()
          if (trimmedKey && trimmedValue) {
            acc[trimmedKey] = trimmedValue
            return acc
          } else {
            throw new Error('Malformed headers')
          }
        }, {} as Record<string, string>)
    }

    await $.auth.set({
      headers,
      screenName: authData.label,
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
