import { IGlobalVariable } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import logger from '@/helpers/logger'

import { validateAuthData } from './auth-data'
import { createSession } from './create-client'

const verifyCredentials = async ($: IGlobalVariable) => {
  try {
    validateAuthData($)
    const { endSession } = await createSession($)
    await endSession()
  } catch (error) {
    if (error instanceof ZodError) {
      // Auth data validation failed: throws message from first error
      throw new Error(fromZodError(error).details[0].message)
    }
    if (error.response?.status === 401) {
      logger.info({
        event: 'databricks-verify-credentials',
        error: error,
      })
      throw new Error('Invalid credentials')
    }
    throw error
  }
}

export default verifyCredentials
