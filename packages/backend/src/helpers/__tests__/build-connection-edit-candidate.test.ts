import type { IApp, IField, IJSONObject } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import buildConnectionEditCandidate from '@/helpers/build-connection-edit-candidate'

function createApp(
  key: string,
  fields: IField[],
): IApp {
  return {
    key,
    auth: {
      connectionType: 'user-added',
      fields,
    },
  } as IApp
}

describe('buildConnectionEditCandidate', () => {
  it('only includes declared auth fields', () => {
    const app = createApp('telegram-bot', [
      {
        key: 'token',
        label: 'Bot token',
        type: 'string',
        required: true,
      },
    ])

    expect(
      buildConnectionEditCandidate({
        app,
        submittedData: {
          token: 'new-token',
          unexpected: 'value',
        },
      }),
    ).toEqual({ token: 'new-token' })
  })

  it('rejects a blank required field', () => {
    const app = createApp('gathersg', [
      {
        key: 'apiKey',
        label: 'API key',
        type: 'string',
        required: true,
      },
    ])

    expect(() =>
      buildConnectionEditCandidate({
        app,
        submittedData: { apiKey: ' ' },
      }),
    ).toThrow('API key is required')
  })

  it('keeps stored Custom API headers when submitted headers are blank', () => {
    const app = createApp('custom-api', [
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
        app,
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
    const app = createApp('custom-api', [
      {
        key: 'headers',
        label: 'Headers',
        type: 'multiline',
        required: false,
      },
    ])

    expect(
      buildConnectionEditCandidate({
        app,
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
