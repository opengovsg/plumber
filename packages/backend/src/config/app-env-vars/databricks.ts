import { z } from 'zod'

import logger from '@/helpers/logger'

export const databricksConfig = Object.freeze({
  serverHostname: process.env.DATABRICKS_SERVER_HOSTNAME,
  httpPath: process.env.DATABRICKS_HTTP_PATH,
  catalog: process.env.DATABRICKS_CATALOG,
  clientId: process.env.DATABRICKS_CLIENT_ID,
  clientSecret: process.env.DATABRICKS_CLIENT_SECRET,
})

const databricksConfigSchema = z.object({
  serverHostname: z.string().min(1, 'Databricks server hostname is required'),
  httpPath: z.string().min(1, 'Databricks HTTP path is required'),
  catalog: z.string().min(1, 'Databricks catalog name is required'),
  clientId: z.string().min(1, 'Databricks client ID is required'),
  clientSecret: z.string().min(1, 'Databricks client secret is required'),
})

const databricksConfigParseResult =
  databricksConfigSchema.safeParse(databricksConfig)

if (databricksConfigParseResult.success === false) {
  logger.error(
    'Invalid databricks configuration',
    databricksConfigParseResult.error,
  )
  throw new Error('Invalid databricks configuration')
}
