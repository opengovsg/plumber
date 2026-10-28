import { describe, expect, it } from 'vitest'

import {
  addLegacySendMode,
  stepTransformer,
} from '../../common/transform-step-parameters'

const { transformStepParameters, getLatestStepVersion } = stepTransformer

const legacyParameters = {
  destinationEmail: 'a@open.gov.sg',
  subject: 'Hi',
  body: '<p>Hello</p>',
  senderName: 'HR',
}

describe('addLegacySendMode', () => {
  it('pins steps without a send mode to individual', () => {
    expect(addLegacySendMode(legacyParameters)).toEqual({
      ...legacyParameters,
      sendMode: 'individual',
    })
  })

  it('is idempotent: an existing send mode is left alone', () => {
    const combined = { ...legacyParameters, sendMode: 'combined' }
    expect(addLegacySendMode(combined)).toBe(combined)
  })
})

describe('stepTransformer for sendTransactionalEmail', () => {
  it('reports version 2 as the latest', () => {
    expect(getLatestStepVersion('sendTransactionalEmail')).toBe(2)
  })

  it('migrates a v1 step to individual mode', () => {
    const result = transformStepParameters(
      'sendTransactionalEmail',
      legacyParameters,
      1,
    )
    expect(result.sendMode).toBe('individual')
  })

  it('leaves a v2 step without a send mode untouched so the schema default applies', () => {
    const result = transformStepParameters(
      'sendTransactionalEmail',
      legacyParameters,
      2,
    )
    expect(result.sendMode).toBeUndefined()
  })
})
