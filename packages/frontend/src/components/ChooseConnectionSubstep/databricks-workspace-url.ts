import { z } from 'zod'

// A later label prefix must not enter the URL. screenName is also the schema name.
const databricksEnvSchema = z.object({
  hostname: z.string().min(1),
  catalog: z.string().min(1),
})

export function databricksWorkspaceUrl( // pragma: allowlist secret
  screenName: string,
  env: string | null | undefined,
): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(env ?? '{}')
  } catch {
    return null
  }

  const result = databricksEnvSchema.safeParse(parsed)
  if (!result.success) {
    return null
  }

  return `https://${result.data.hostname}/explore/data/${result.data.catalog}/${screenName}`
}
