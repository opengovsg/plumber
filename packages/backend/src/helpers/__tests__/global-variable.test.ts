import type { IApp, IJSONObject } from '@plumber/types'

import { describe, expect, it, vi } from 'vitest'

import globalVariable from '@/helpers/global-variable'
import Connection from '@/models/connection'

describe('globalVariable auth persistence', () => {
  const app = {
    apiBaseUrl: '',
    beforeRequest: [],
  } as unknown as IApp

  it('does not persist auth updates when no connection is passed', async () => {
    const candidate: IJSONObject = { token: 'candidate-token' }

    const $ = await globalVariable({
      app,
    })

    await $.auth.set(candidate)
    await $.auth.set({ screenName: 'Candidate bot' })

    expect($.auth.data).toEqual({
      token: 'candidate-token',
      screenName: 'Candidate bot',
    })
    expect($.auth.connectionId).toBeUndefined()
  })

  it('continues to persist auth updates by default', async () => {
    const patchAndFetch = vi.fn()
    const connection = {
      id: 'connection-id',
      formattedData: { token: 'stored-token' },
      $query: () => ({ patchAndFetch }),
    } as unknown as Connection

    const $ = await globalVariable({ app, connection })
    await $.auth.set({ screenName: 'Stored bot' })

    expect(patchAndFetch).toHaveBeenCalledWith({
      formattedData: {
        token: 'stored-token',
        screenName: 'Stored bot',
      },
    })
  })
})
