import { describe, expect, it } from 'vitest'

import {
  getStaticSensitiveHeaderKeys,
  hasStepVariable,
  isSensitiveHeaderName,
} from '../../common/sensitive-headers'

const STEP_TOKEN =
  'Bearer {{step.aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.data.token}}'

describe('sensitive custom API headers', () => {
  it.each([
    'Authorization',
    'authorization',
    'AUTHORIZATION',
    ' Proxy-Authorization ',
    'X-API-Key',
    'api-key',
    'X-Auth-Token',
  ])('treats %s as sensitive', (key) => {
    expect(isSensitiveHeaderName(key)).toBe(true)
  })

  it.each(['Content-Type', 'Accept', 'X-Request-Id', 'Cookie', 'Token'])(
    'does not treat %s as sensitive',
    (key) => {
      expect(isSensitiveHeaderName(key)).toBe(false)
    },
  )

  it('detects step variables in header values', () => {
    expect(hasStepVariable(STEP_TOKEN)).toBe(true)
    expect(hasStepVariable('Bearer sk-live-123')).toBe(false)
    expect(hasStepVariable('{{not-a-step-var}}')).toBe(false)
  })

  it('returns static sensitive keys from row arrays', () => {
    expect(
      getStaticSensitiveHeaderKeys([
        { key: 'Content-Type', value: 'application/json' },
        { key: 'Authorization', value: 'Bearer secret' },
        { key: 'X-API-Key', value: 'abc' },
      ]),
    ).toEqual(['Authorization', 'X-API-Key'])
  })

  it('allows sensitive keys when the value contains a step variable', () => {
    expect(
      getStaticSensitiveHeaderKeys([
        { key: 'Authorization', value: STEP_TOKEN },
      ]),
    ).toEqual([])
  })

  it.each([undefined, null, []])('returns nothing for %s', (headers) => {
    expect(getStaticSensitiveHeaderKeys(headers)).toEqual([])
  })
})
