export const POST_LOGIN_REDIRECT_KEY = 'post-login-redirect'

const MAX_INTERNAL_PATH_LENGTH = 2048

/**
 * True only for same-origin relative paths that cannot be interpreted as a
 * protocol-relative URL (`//host`) after browser URL parsing.
 *
 * Rejects backslashes because some parsers treat `\` like `/`, so a value such
 * as `/\attacker.com` can become `//attacker.com`.
 */
export function isSafeInternalPath(
  path: string | null | undefined,
): path is string {
  if (typeof path !== 'string' || path.length === 0) {
    return false
  }
  if (path.length > MAX_INTERNAL_PATH_LENGTH) {
    return false
  }
  if (path.includes('\\') || /[\0\r\n\t]/.test(path)) {
    return false
  }
  if (!path.startsWith('/') || path.startsWith('//')) {
    return false
  }
  if (typeof window === 'undefined') {
    return true
  }

  try {
    const origin = window.location.origin
    const resolved = new URL(path, origin)
    return (
      resolved.origin === origin &&
      resolved.protocol === new URL(origin).protocol &&
      resolved.pathname.startsWith('/') &&
      !resolved.pathname.startsWith('//')
    )
  } catch {
    return false
  }
}

export function storePostLoginRedirect(path: string | null | undefined): void {
  if (isSafeInternalPath(path)) {
    sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, path)
    return
  }

  if (typeof path !== 'string' || typeof window === 'undefined') {
    return
  }

  try {
    const url = new URL(path, window.location.origin)
    if (url.origin !== window.location.origin) {
      return
    }
    const internalPath = `${url.pathname}${url.search}${url.hash}`
    if (isSafeInternalPath(internalPath)) {
      sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, internalPath)
    }
  } catch {
    // Ignore malformed initiate-login target_link_uri values.
  }
}

export function consumePostLoginRedirect(): string | null {
  const stored = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY)
  sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
  return isSafeInternalPath(stored) ? stored : null
}

export function clearPostLoginRedirect(): void {
  sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
}
