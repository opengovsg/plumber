import { IGlobalVariable } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { validateAuthData } from './auth-data'
import { createClient } from './create-client'

const verifyCredentials = async ($: IGlobalVariable) => {
  try {
    validateAuthData($)
    const client = await createClient($)
    await client.close()
  } catch (error) {
    if (error instanceof ZodError) {
      // Auth data validation failed: throws message from first error
      throw new Error(fromZodError(error).details[0].message)
    }
    throw error
  }
}

export default verifyCredentials
