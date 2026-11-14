// A later label prefix must not enter the URL. screenName is also the schema name.
// oxfmt-ignore
export function databricksWorkspaceUrl( // pragma: allowlist secret
  screenName: string,
  env: string | null | undefined,
): string | null {
  try {
    const { hostname, catalog } = JSON.parse(env ?? '{}') as {
      hostname: string
      catalog: string
    }
    if (!hostname || !catalog) {
      return null
    }
    return `https://${hostname}/explore/data/${catalog}/${screenName}`
  } catch {
    return null
  }
}
