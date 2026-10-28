const DATABRICKS_AUTH_TOKEN_REDIS_PREFIX = 'databricks:authToken:'

export function databricksAuthTokenRedisKey(input: {
  clientId: string
  serverHostname: string
}): string {
  return (
    DATABRICKS_AUTH_TOKEN_REDIS_PREFIX +
    encodeURIComponent(input.clientId) +
    ':' +
    encodeURIComponent(input.serverHostname)
  )
}
