import type { IApp, IJSONObject } from '@plumber/types'
import { describe, expect, it, vi } from 'vitest'

import globalVariable from '@/helpers/global-variable'
import Connection from '@/models/connection'
import type Execution from '@/models/execution'

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

  it('does not persist auth updates when merged data is unchanged', async () => {
    const patchAndFetch = vi.fn()
    const connection = {
      id: 'connection-id',
      formattedData: {
        token: 'stored-token',
        screenName: 'Stored bot',
      },
      $query: () => ({ patchAndFetch }),
    } as unknown as Connection

    const $ = await globalVariable({ app, connection })
    await $.auth.set({ screenName: 'Stored bot' })

    expect(patchAndFetch).not.toHaveBeenCalled()
    expect($.auth.data).toEqual({
      token: 'stored-token',
      screenName: 'Stored bot',
    })
  })
})

describe('globalVariable execution', () => {
  const app = {
    apiBaseUrl: '',
    beforeRequest: [],
  } as unknown as IApp

  it('exposes the execution start time as an ISO string', async () => {
    const execution = {
      id: 'execution-id',
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
    } as unknown as Execution

    const $ = await globalVariable({ app, execution })

    expect($.execution.createdAt).toBe('2026-01-02T03:04:05.000Z')
  })

  it('leaves the execution start time undefined without an execution', async () => {
    const $ = await globalVariable({ app })

    expect($.execution.createdAt).toBeUndefined()
  })
})
