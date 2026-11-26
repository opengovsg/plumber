import { z } from 'zod'

// A later label prefix must not enter the URL. screenName is also the schema name.
const databricksEnvSchema = z.object({
  hostname: z.string().min(1),
  catalog: z.string().min(1),
})

export function databricksExploreUrl(
  screenName: string,
  env?: string,
): string | null {
  try {
    const { hostname, catalog } = databricksEnvSchema.parse(
      JSON.parse(env ?? '{}'),
    )
    const url = new URL(`https://${hostname}`)
    // Rejects a hostname that smuggles in a path, query or userinfo.
    if (url.host !== hostname) {
      return null
    }
    url.pathname = ['explore', 'data', catalog, screenName]
      .map(encodeURIComponent)
      .join('/')
    return url.toString()
  } catch {
    return null
  }
}
