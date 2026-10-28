import { describe, expect, it } from 'vitest'

import { databricksAuthTokenRedisKey } from './auth-token-redis-key'

const PREFIX = 'databricks:authToken:'

describe('databricksAuthTokenRedisKey', () => {
  it('gives different keys for one hostname and two client ids', () => {
    const left = databricksAuthTokenRedisKey({
      clientId: 'client-a',
      serverHostname: 'sql.example',
    })
    const right = databricksAuthTokenRedisKey({
      clientId: 'client-b',
      serverHostname: 'sql.example',
    })

    expect(left.startsWith(PREFIX)).toBe(true)
    expect(right.startsWith(PREFIX)).toBe(true)
    expect(left).toBe(`${PREFIX}client-a:sql.example`)
    expect(right).toBe(`${PREFIX}client-b:sql.example`)
    expect(left).not.toBe(right)
  })

  it('gives different keys for one client id and two hostnames', () => {
    const left = databricksAuthTokenRedisKey({
      clientId: 'client-a',
      serverHostname: 'sql.example',
    })
    const right = databricksAuthTokenRedisKey({
      clientId: 'client-a',
      serverHostname: 'other.example',
    })

    expect(left.startsWith(PREFIX)).toBe(true)
    expect(right.startsWith(PREFIX)).toBe(true)
    expect(left).toBe(`${PREFIX}client-a:sql.example`)
    expect(right).toBe(`${PREFIX}client-a:other.example`)
    expect(left).not.toBe(right)
  })

  it('keeps a colon inside a client id from merging with the hostname', () => {
    const left = databricksAuthTokenRedisKey({
      clientId: 'a:b',
      serverHostname: 'c.example',
    })
    const right = databricksAuthTokenRedisKey({
      clientId: 'a',
      serverHostname: 'b:c.example',
    })

    expect(left.startsWith(PREFIX)).toBe(true)
    expect(right.startsWith(PREFIX)).toBe(true)
    expect(left).toBe(`${PREFIX}a%3Ab:c.example`)
    expect(right).toBe(`${PREFIX}a:b%3Ac.example`)
    expect(left).not.toBe(right)
  })
})
