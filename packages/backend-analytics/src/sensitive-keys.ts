// IMPORTANT: mirrors packages/backend/src/helpers/redaction/sensitive-keys.ts. A test fails when the two differ.
// This package cannot import the backend.

const SENSITIVE_HEADER_NAMES = [
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
]

const NON_HEADER_SECRET_KEY_FRAGMENTS = [
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

export const SECRET_KEY_REGEXP = new RegExp(
  [
    ...SENSITIVE_HEADER_NAMES.map(toKeyFragment),
    ...NON_HEADER_SECRET_KEY_FRAGMENTS,
  ].join('|'),
  'i',
)
