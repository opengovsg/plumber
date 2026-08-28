export const POST_LOGIN_REDIRECT_KEY = 'post-login-redirect'

export function isSafeInternalPath(
  path: string | null | undefined,
): path is string {
  return (
    typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')
  )
}

export function storePostLoginRedirect(path: string | null | undefined): void {
  if (isSafeInternalPath(path)) {
    sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, path)
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
