export function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} environment variable needs to be set!`)
  }
  return value
}
