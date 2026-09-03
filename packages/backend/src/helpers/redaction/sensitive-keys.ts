/**
 * Header names that typically carry credentials. These belong in a Custom API
 * connection (encrypted at rest) rather than in a step's Custom Headers, which
 * are stored as plaintext step parameters.
 */
export const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'proxy-authorization',
  'api-key',
  'x-api-key',
  'x-apikey',
  'apikey',
  'x-auth-token',
  'x-access-token',
  'access-token',
  'auth-token',
  'x-secret-key',
  'secret-key',
])

/**
 * Secret-bearing key fragments that are not HTTP header names, so they cannot
 * live in SENSITIVE_HEADER_NAMES. Header validation must not use them, since
 * rejecting a user's legitimate header is user-facing.
 */
export const NON_HEADER_SECRET_KEY_FRAGMENTS = [
  'token',
  'secret',
  'cookie',
  'passw',
  'passphrase',
  'credential',
  'private[-_]?key',
  'signature',
  'session',
  'bearer',
]

const toKeyFragment = (name: string): string =>
  name
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Match `access-token`, `access_token` and `accessToken` alike.
    .replace(/[-_]/g, '[-_]?')

/** Matches any object key whose name suggests it holds a secret. */
export const SECRET_KEY_REGEXP = new RegExp(
  [
    ...[...SENSITIVE_HEADER_NAMES].map(toKeyFragment),
    ...NON_HEADER_SECRET_KEY_FRAGMENTS,
  ].join('|'),
  'i',
)

/** Replaces any value the access log must not carry. */
export const REDACTED = '[redacted]'
