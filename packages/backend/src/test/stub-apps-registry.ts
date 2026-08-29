export function stubAppsRegistry(
  apps: Record<string, unknown>,
  stub: Record<string, unknown>,
): () => void {
  const snapshot = { ...apps }

  for (const key of Object.keys(apps)) {
    delete apps[key]
  }
  Object.assign(apps, stub)

  return () => {
    for (const key of Object.keys(apps)) {
      delete apps[key]
    }
    Object.assign(apps, snapshot)
  }
}
