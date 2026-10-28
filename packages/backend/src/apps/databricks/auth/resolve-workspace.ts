import {
  databricksConfig,
  databricksConfigSchema,
  readNewDatabricksConfig,
} from '@/config/app-env-vars/databricks'

// oxfmt-ignore
export function resolveDatabricksWorkspace( // pragma: allowlist secret
  generation: 'legacy' | 'new',
) {
  switch (generation) {
    case 'legacy':
      return databricksConfig
    case 'new':
      return Object.freeze(
        databricksConfigSchema.parse(readNewDatabricksConfig()),
      )
    default: {
      const unexpected: never = generation
      throw new Error(`Unknown Databricks credential generation: ${unexpected}`)
    }
  }
}
