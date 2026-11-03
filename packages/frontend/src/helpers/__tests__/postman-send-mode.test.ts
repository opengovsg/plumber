import { describe, expect, it } from 'vitest'

import { getSendModeChange, toIsoTimestamp } from '../postman-send-mode'

const postman = { appKey: 'postman', key: 'sendTransactionalEmail' }

describe('getSendModeChange', () => {
  it('reports a new step saved as individual', () => {
    expect(
      getSendModeChange(
        { ...postman, parameters: {} },
        { ...postman, parameters: { sendMode: 'individual' } },
      ),
    ).toEqual({ from: 'combined', to: 'individual' })
  })

  it('reports an old step switched to combined', () => {
    expect(
      getSendModeChange(
        { ...postman, parameters: { sendMode: 'individual' } },
        { ...postman, parameters: { sendMode: 'combined' } },
      ),
    ).toEqual({ from: 'individual', to: 'combined' })
  })

  it('treats a step that just became a Postman step as on the default', () => {
    expect(
      getSendModeChange(
        { appKey: '', key: '', parameters: {} },
        { ...postman, parameters: { sendMode: 'individual' } },
      ),
    ).toEqual({ from: 'combined', to: 'individual' })
  })

  it('returns null when the send mode is unchanged', () => {
    expect(
      getSendModeChange(
        { ...postman, parameters: {} },
        { ...postman, parameters: { sendMode: 'combined' } },
      ),
    ).toBeNull()
  })

  it('returns null for other steps', () => {
    expect(
      getSendModeChange(undefined, {
        appKey: 'slack',
        key: 'sendMessage',
        parameters: {},
      }),
    ).toBeNull()
  })
})

describe('toIsoTimestamp', () => {
  it('converts an epoch-millisecond string', () => {
    expect(toIsoTimestamp('1700000000000')).toBe('2023-11-14T22:13:20.000Z')
  })

  it('returns undefined for a missing or invalid value', () => {
    expect(toIsoTimestamp(undefined)).toBeUndefined()
    expect(toIsoTimestamp('not-a-date')).toBeUndefined()
  })
})
