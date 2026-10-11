/**
 * Patches the global `fetch()`.
 *
 * Node's `fetch()` runs on undici, which bypasses `http.request`, so it needs its own patch.
 */
import type { DevRequest, DevRequestRule } from '../types'

import { applyRules, hasApplicableRule } from './apply-rules'
import { logBuildFailure } from './log-build-failure'

function buildRequest(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
): DevRequest | null {
  try {
    return {
      url: new URL(input instanceof Request ? input.url : input),
      headers: new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      ),
      agent: undefined,
    }
  } catch (error) {
    logBuildFailure('fetch', error)
    return null
  }
}

export function patchFetch(rules: readonly DevRequestRule[]): void {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (input, init) => {
    const request = buildRequest(input, init)
    if (!request || !hasApplicableRule(rules, request)) {
      return originalFetch(input, init)
    }

    applyRules(rules, request)
    return originalFetch(
      input instanceof Request ? new Request(request.url, input) : request.url,
      { ...init, headers: request.headers },
    )
  }
}
