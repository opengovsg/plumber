import http from 'http'
import https from 'https'
import { syncBuiltinESMExports } from 'module'

import { DEV_REQUEST_RULES } from '../rules'
import type { DevRequestRule } from '../types'

import { patchFetch } from './patch-fetch'
import { patchRequest } from './patch-http'

let installed = false

/**
 * Starts the engine, which applies dev request rules to `http.request`, `https.request` and `fetch`.
 *
 * IMPORTANT: Some clients cache `https.request` on first use (e.g. the OTLP
 * exporter), so install this before anything sends requests.
 */
export function install(
  rules: readonly DevRequestRule[] = DEV_REQUEST_RULES,
): void {
  // A second install would wrap the first, applying every rule twice.
  if (installed) {
    throw new Error('Node.js dev HTTP interceptor is already installed')
  }
  installed = true

  patchRequest(http, rules, 'http:')
  patchRequest(https, rules, 'https:')
  // Updates `import('https')` namespaces, which the OTLP exporter uses.
  syncBuiltinESMExports()
  patchFetch(rules)
}
