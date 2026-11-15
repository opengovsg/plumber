import {
  databricksConfig,
  databricksConfigSchema,
  readNewDatabricksConfig,
} from '@/config/app-env-vars/databricks'

const NEW_CONFIGURATION_VARS = [
  'DATABRICKS_NEW_SERVER_HOSTNAME',
  'DATABRICKS_NEW_HTTP_PATH',
  'DATABRICKS_NEW_CATALOG',
  'DATABRICKS_NEW_CLIENT_ID',
  'DATABRICKS_NEW_CLIENT_SECRET',
] as const

function readNewConfiguration() {
  const parsed = databricksConfigSchema.safeParse(readNewDatabricksConfig())
  if (!parsed.success) {
    throw new Error(
      `Invalid Databricks new configuration. Check ${NEW_CONFIGURATION_VARS.join(', ')}.`,
    )
  }
  return Object.freeze(parsed.data)
}

// oxfmt-ignore
export function resolveDatabricksWorkspace( // pragma: allowlist secret
  generation: 'legacy' | 'new',
) {
  switch (generation) {
    case 'legacy':
      return databricksConfig
    case 'new':
      return readNewConfiguration()
    default: {
      const unexpected: never = generation
      throw new Error(`Unknown Databricks credential generation: ${unexpected}`)
    }
  }
}
