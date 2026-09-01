import { describe, expect, it } from 'vitest'

import { SECRET_KEY_REGEXP, SENSITIVE_HEADER_NAMES } from '../sensitive-keys'

describe('SECRET_KEY_REGEXP', () => {
  it.each([...SENSITIVE_HEADER_NAMES])(
    'matches the sensitive header name %s',
    (name) => {
      expect(SECRET_KEY_REGEXP.test(name)).toBe(true)
    },
  )

  it.each([
    'authorization',
    'Authorization',
    'x-api-key',
    'apiKey',
    'access_token',
    'accessToken',
    'refresh_token',
    'refreshToken',
    'clientSecret',
    'client_secret',
    'cookie',
    'Cookie',
    'set-cookie',
    'password',
    'passwordHash',
    'passphrase',
    'credentials',
    'privateKey',
    'private_key',
    'signature',
    'sessionId',
    'bearerToken',
  ])('matches the secret-bearing key %s', (key) => {
    expect(SECRET_KEY_REGEXP.test(key)).toBe(true)
  })

  it.each([
    'flowId',
    'executionId',
    'stepId',
    'status',
    'statusText',
    'event',
    'url',
    'method',
    'count',
  ])('leaves the debugging key %s alone', (key) => {
    expect(SECRET_KEY_REGEXP.test(key)).toBe(false)
  })
})
