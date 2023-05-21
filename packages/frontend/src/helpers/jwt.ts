// does not validate the token, just decodes it
// written with github co-pilot
export function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(''),
    )
    return JSON.parse(jsonPayload)
  } catch (e) {
    return null
  }
}

export function isJwtExpired(token: string): boolean {
  const decoded = decodeJwt(token)
  if (decoded == null) {
    return true
  }
  const exp = decoded.exp as number
  const now = Date.now()
  return exp * 1000 < now
}
