import { IGlobalVariable } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { databricksConfig } from '@/config/app-env-vars/databricks'
import logger from '@/helpers/logger'

import { validateAuthData } from './auth-data'
import { createClient } from './create-client'

const verifyCredentials = async ($: IGlobalVariable) => {
  try {
    validateAuthData($)
    const client = await createClient($)
    const session = await client.openSession({
      initialCatalog: databricksConfig.catalog,
    })
    await session.close()
    await client.close()
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
