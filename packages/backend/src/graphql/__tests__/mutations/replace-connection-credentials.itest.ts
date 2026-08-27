import type { IGlobalVariable, IJSONObject } from '@plumber/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import replaceConnectionCredentials from '@/graphql/mutations/replace-connection-credentials'
import Connection from '@/models/connection'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockContext } from './tiles/table.mock'
import { generateMockUser } from './flow.mock'

const mocks = vi.hoisted(() => ({
  verifyCredentials: vi.fn(),
}))

vi.mock('@/helpers/global-variable', () => ({
  default: vi.fn(
    async ({
      authData,
    }: {
      authData: IJSONObject
    }): Promise<IGlobalVariable> => {
      const $ = {
        auth: {
          data: authData,
          set: async (updates: IJSONObject) => {
            $.auth.data = {
              ...$.auth.data,
              ...updates,
            }
            return null
          },
        },
      }

      return $ as unknown as IGlobalVariable
    },
  ),
}))

vi.mock('@/models/app', () => ({
  default: {
    findOneByKey: vi.fn().mockResolvedValue({
      key: 'telegram-bot',
      auth: {
        connectionType: 'user-added',
        supportsConnectionEdit: true,
        fields: [
          {
            key: 'token',
            label: 'Bot token',
            type: 'string',
            required: true,
          },
        ],
        verifyCredentials: mocks.verifyCredentials,
      },
    }),
  },
}))

describe('replaceConnectionCredentials', () => {
  let context: Context
  let owner: User
  let otherUser: User
  let connection: Connection

  beforeEach(async () => {
    vi.clearAllMocks()
    await Connection.query().delete()

    context = await generateMockContext()
    owner = context.currentUser
    otherUser = await generateMockUser('editor')
    connection = await Connection.query().insertAndFetch({
      userId: owner.id,
      key: 'telegram-bot',
      formattedData: {
        token: 'old-token',
        screenName: 'Old bot',
        legacyField: 'remove-me',
      },
      verified: true,
      draft: false,
    })
  })

  it('replaces credentials only after verification succeeds', async () => {
    mocks.verifyCredentials.mockImplementationOnce(
      async ($: IGlobalVariable) => {
        expect($.auth.data).toEqual({ token: 'new-token' })
        await $.auth.set({ screenName: 'New bot' })
      },
    )

    await replaceConnectionCredentials(
      null,
      {
        input: {
          id: connection.id,
          formattedData: { token: 'new-token' },
        },
      },
      context,
    )

    const updated = await Connection.query().findById(connection.id)
    expect(updated.formattedData).toEqual({
      token: 'new-token',
      screenName: 'New bot',
    })
    expect(updated.verified).toBe(true)
  })

  it('leaves the stored connection unchanged when verification fails', async () => {
    mocks.verifyCredentials.mockRejectedValueOnce(new Error('Invalid token'))
    const before = await Connection.query().findById(connection.id)

    await expect(
      replaceConnectionCredentials(
        null,
        {
          input: {
            id: connection.id,
            formattedData: { token: 'invalid-token' },
          },
        },
        context,
      ),
    ).rejects.toThrow('Invalid token')

    const after = await Connection.query().findById(connection.id)
    expect(after.formattedData).toEqual(before.formattedData)
    expect(after.verified).toBe(before.verified)
    expect(after.updatedAt).toEqual(before.updatedAt)
  })

  it('rejects blank required credentials before verification', async () => {
    await expect(
      replaceConnectionCredentials(
        null,
        {
          input: {
            id: connection.id,
            formattedData: { token: '' },
          },
        },
        context,
      ),
    ).rejects.toThrow('Bot token is required')

    expect(mocks.verifyCredentials).not.toHaveBeenCalled()
  })

  it('does not allow a user to edit another user connection', async () => {
    context.currentUser = otherUser

    await expect(
      replaceConnectionCredentials(
        null,
        {
          input: {
            id: connection.id,
            formattedData: { token: 'new-token' },
          },
        },
        context,
      ),
    ).rejects.toThrow('Connection not found')
    expect(mocks.verifyCredentials).not.toHaveBeenCalled()
  })
})
