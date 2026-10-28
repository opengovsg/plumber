import {
  databricksConfig,
  databricksConfigSchema,
  readNewDatabricksConfig,
} from '@/config/app-env-vars/databricks'

let parsedNewInput: ReturnType<typeof readNewDatabricksConfig> | undefined
let parsedNewCredentials:
  | ReturnType<typeof databricksConfigSchema.parse>
  | undefined

// A fresh Zod parse allocates. Repeating it lets a later call stall.
function resolveNewDatabricksConfig() {
  const input = readNewDatabricksConfig()
  if (
    parsedNewCredentials &&
    parsedNewInput &&
    parsedNewInput.serverHostname === input.serverHostname &&
    parsedNewInput.httpPath === input.httpPath &&
    parsedNewInput.catalog === input.catalog &&
    parsedNewInput.clientId === input.clientId &&
    parsedNewInput.clientSecret === input.clientSecret
  ) {
    return parsedNewCredentials
  }

  const credentials = Object.freeze(databricksConfigSchema.parse(input))
  parsedNewInput = input
  parsedNewCredentials = credentials
  return credentials
}

// oxfmt-ignore
export function resolveDatabricksWorkspace( // pragma: allowlist secret
  generation: 'legacy' | 'new',
) {
  switch (generation) {
    case 'legacy':
      return databricksConfig
    case 'new':
      return resolveNewDatabricksConfig()
    default: {
      const unexpected: never = generation
      throw new Error(`Unknown Databricks credential generation: ${unexpected}`)
    }
  }
}
