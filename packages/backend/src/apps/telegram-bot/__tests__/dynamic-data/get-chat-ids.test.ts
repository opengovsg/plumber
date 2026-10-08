import { IGlobalVariable } from '@plumber/types'

import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'

import getChatIds, {
  UPDATES_CONFLICT_MESSAGE,
} from '../../dynamic-data/get-chat-ids'

const mocks = vi.hoisted(() => ({
  httpGet: vi.fn(),
}))

function makeHttpError(status: number, data: unknown): HttpError {
  return new HttpError({
    message: `Request failed with status code ${status}`,
    response: { status, data },
  } as AxiosError)
}

describe('get chat ids', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    vi.resetAllMocks()
    $ = {
      http: {
        get: mocks.httpGet,
      } as unknown as IGlobalVariable['http'],
    } as unknown as IGlobalVariable
  })

  it('returns unique chats from the latest updates first', async () => {
    mocks.httpGet.mockResolvedValueOnce({
      data: {
        ok: true,
        result: [
          {
            update_id: 1,
            message: { chat: { id: 1, title: 'old', type: 'group' } },
          },
          {
            update_id: 2,
            message: { chat: { id: 2, username: 'bob', type: 'private' } },
          },
          {
            update_id: 3,
            message: { chat: { id: 1, title: 'new', type: 'group' } },
          },
        ],
      },
    })

    await expect(getChatIds.run($)).resolves.toEqual({
      data: [
        { name: 'new (group)', value: '1' },
        { name: 'bob (private)', value: '2' },
      ],
    })
  })

  it('returns a plain message when another service owns the bot updates', async () => {
    mocks.httpGet.mockRejectedValueOnce(
      makeHttpError(409, {
        ok: false,
        error_code: 409,
        description:
          "Conflict: can't use getUpdates method while webhook is active; use deleteWebhook to delete the webhook first",
      }),
    )

    await expect(getChatIds.run($)).resolves.toEqual({
      data: [],
      error: { message: UPDATES_CONFLICT_MESSAGE },
    })
  })

  it('returns the Telegram description for other HTTP errors', async () => {
    mocks.httpGet.mockRejectedValueOnce(
      makeHttpError(401, {
        ok: false,
        error_code: 401,
        description: 'Unauthorized',
      }),
    )

    await expect(getChatIds.run($)).resolves.toEqual({
      data: [],
      error: { message: 'Unauthorized' },
    })
  })

  it('returns the error message when there is no Telegram description', async () => {
    mocks.httpGet.mockRejectedValueOnce(new Error('socket hang up'))

    await expect(getChatIds.run($)).resolves.toEqual({
      data: [],
      error: { message: 'socket hang up' },
    })
  })
})
