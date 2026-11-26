import { describe, expect, it } from 'vitest'

import { databricksAuthTokenRedisKey } from '../../auth/auth-token-redis-key'

const PREFIX = 'databricks:authToken:'

describe('databricksAuthTokenRedisKey', () => {
  it('separates client id and hostname', () => {
    expect(
      databricksAuthTokenRedisKey({
        clientId: 'client-a',
        serverHostname: 'sql.example',
      }),
    ).toBe(`${PREFIX}client-a:sql.example`)
    expect(
      databricksAuthTokenRedisKey({
        clientId: 'client-b',
        serverHostname: 'sql.example',
      }),
    ).toBe(`${PREFIX}client-b:sql.example`)
    expect(
      databricksAuthTokenRedisKey({
        clientId: 'client-a',
        serverHostname: 'other.example',
      }),
    ).toBe(`${PREFIX}client-a:other.example`)
  })

  it('encodes a colon so the two parts stay distinct', () => {
    expect(
      databricksAuthTokenRedisKey({
        clientId: 'a:b',
        serverHostname: 'c.example',
      }),
    ).toBe(`${PREFIX}a%3Ab:c.example`)
    expect(
      databricksAuthTokenRedisKey({
        clientId: 'a',
        serverHostname: 'b:c.example',
      }),
    ).toBe(`${PREFIX}a:b%3Ac.example`)
  })
})
