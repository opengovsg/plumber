export function getConnectionEnvLabel(env?: string | null): string | null {
  if (env === 'test') {
    return 'Staging'
  }

  if (env === 'live') {
    return 'Production'
  }

  return null
}
