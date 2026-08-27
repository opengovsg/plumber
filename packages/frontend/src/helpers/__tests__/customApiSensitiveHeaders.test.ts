import { describe, expect, it } from 'vitest'

import {
  getStaticSensitiveHeaderKeys,
  hasStepVariable,
  isSensitiveHeaderName,
} from '../customApiSensitiveHeaders'

const STEP_TOKEN =
  'Bearer {{step.aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.data.token}}'

describe('customApiSensitiveHeaders', () => {
  it('flags Authorization-like names and ignores others', () => {
    expect(isSensitiveHeaderName('Authorization')).toBe(true)
    expect(isSensitiveHeaderName('x-api-key')).toBe(true)
    expect(isSensitiveHeaderName('Content-Type')).toBe(false)
    expect(isSensitiveHeaderName('Cookie')).toBe(false)
  })

  it('detects plumber step variables', () => {
    expect(hasStepVariable(STEP_TOKEN)).toBe(true)
    expect(hasStepVariable('Bearer static-secret')).toBe(false)
  })

  it('returns static secret header keys for the warning banner', () => {
    expect(
      getStaticSensitiveHeaderKeys([
        { key: 'Accept', value: 'application/json' },
        { key: 'Authorization', value: 'Bearer secret' },
        { key: 'Authorization', value: STEP_TOKEN },
      ]),
    ).toEqual(['Authorization'])
  })
})
