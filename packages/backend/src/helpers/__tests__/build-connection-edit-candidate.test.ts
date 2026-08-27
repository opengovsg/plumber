import type {
  IField,
  IJSONObject,
  IUserAddedConnectionAuth,
} from '@plumber/types'

import { describe, expect, it } from 'vitest'

import buildConnectionEditCandidate from '@/helpers/build-connection-edit-candidate'

function createAuth(fields: IField[]): IUserAddedConnectionAuth {
  return {
    connectionType: 'user-added',
    fields,
  }
}

describe('buildConnectionEditCandidate', () => {
  it('only includes declared auth fields', () => {
    const auth = createAuth([
      {
        key: 'token',
        label: 'Bot token',
        type: 'string',
        required: true,
      },
    ])

    expect(
      buildConnectionEditCandidate({
        appKey: 'telegram-bot',
        auth,
        submittedData: {
          token: 'new-token',
          unexpected: 'value',
        },
      }),
    ).toEqual({ token: 'new-token' })
  })

  it('rejects a blank required field', () => {
    const auth = createAuth([
      {
        key: 'apiKey',
        label: 'API key',
        type: 'string',
        required: true,
      },
    ])

    expect(() =>
      buildConnectionEditCandidate({
        appKey: 'gathersg',
        auth,
        submittedData: { apiKey: ' ' },
      }),
    ).toThrow('API key is required')
  })

  it('keeps stored Custom API headers when submitted headers are blank', () => {
    const auth = createAuth([
      {
        key: 'label',
        label: 'Label',
        type: 'string',
        required: true,
      },
      {
        key: 'headers',
        label: 'Headers',
        type: 'multiline',
        required: false,
      },
    ])
    const storedData: IJSONObject = {
      screenName: 'Existing API',
      headers: {
        Authorization: 'Bearer old-token',
        'X-Custom': 'value',
      },
    }

    expect(
      buildConnectionEditCandidate({
        appKey: 'custom-api',
        auth,
        storedData,
        submittedData: {
          label: 'Updated API',
          headers: '',
        },
      }),
    ).toEqual({
      label: 'Updated API',
      headers: 'Authorization=Bearer old-token\nX-Custom=value',
    })
  })

  it('uses new Custom API headers when provided', () => {
    const auth = createAuth([
      {
        key: 'headers',
        label: 'Headers',
        type: 'multiline',
        required: false,
      },
    ])

    expect(
      buildConnectionEditCandidate({
        appKey: 'custom-api',
        auth,
        storedData: {
          headers: { Authorization: 'Bearer old-token' },
        },
        submittedData: {
          headers: 'Authorization=Bearer new-token',
        },
      }),
    ).toEqual({ headers: 'Authorization=Bearer new-token' })
  })
})
