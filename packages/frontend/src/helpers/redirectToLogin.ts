import { NOT_AUTHORISED } from '@/config/errors'
import * as URLS from '@/config/urls'

export function getLoginRedirectHref(
  pathnameAndSearch: string = window.location.pathname + window.location.search,
): string {
  return URLS.ADD_REDIRECT_TO_LOGIN(encodeURIComponent(pathnameAndSearch))
}

export function redirectToLogin(): void {
  window.location.href = getLoginRedirectHref()
}

export function isNotAuthorisedError(error: { message?: string }): boolean {
  const message = error.message ?? ''
  return message === NOT_AUTHORISED || message.includes(NOT_AUTHORISED)
}
