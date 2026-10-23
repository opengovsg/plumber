import { makeExecutableSchema } from '@graphql-tools/schema'
import { GraphQLResolveInfo, GraphQLSchema } from 'graphql'
import { applyMiddleware } from 'graphql-middleware'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { UnauthorisedError } from '@/errors/graphql-errors'

import authentication, { setCurrentUserContext } from '../authentication'

const mocks = vi.hoisted(() => ({
  getAdminTokenUser: vi.fn(),
  getLoggedInUser: vi.fn(),
  parseAdminToken: vi.fn(),
}))

vi.mock('@/helpers/auth', () => ({
  getAdminTokenUser: mocks.getAdminTokenUser,
  getLoggedInUser: mocks.getLoggedInUser,
  parseAdminToken: mocks.parseAdminToken,
}))

describe('GraphQL Authentication', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('setCurrentUserContext', () => {
    it('parses admin token if available', async () => {
      mocks.parseAdminToken.mockReturnValueOnce({
        userEmail: 'test@plumber.local',
      })
      mocks.getAdminTokenUser.mockReturnValueOnce({
        id: 'test-user-id',
      })

      const result = await setCurrentUserContext({
        req: {
          headers: {
            'x-plumber-admin-token': 'test-token',
          },
        },
      } as unknown as any)
      expect(mocks.parseAdminToken).toBeCalled()
      expect(mocks.getAdminTokenUser).toBeCalled()
      expect(result.currentUser.id).toEqual('test-user-id')
    })

    it('does not invoke admin-related functions if admin header not set', async () => {
      await setCurrentUserContext({ req: { headers: {} } } as unknown as any)
      expect(mocks.parseAdminToken).not.toBeCalled()
      expect(mocks.getAdminTokenUser).not.toBeCalled()
    })
  })

  describe('admin mutation allowlist', () => {
    const typeDefs = /* GraphQL */ `
      type Query {
        healthcheck: Boolean
        getTable: Boolean
        getAllRows: Boolean
        getCurrentUser: Boolean
        getPlumberStats: Boolean
      }
      type Mutation {
        upsertFlowCollaborator: Boolean
        createFlowTransfer: Boolean
        deleteFlow: Boolean
        retryPartialStep: Boolean
        retryExecutionStep: Boolean
        bulkRetryExecutions: Boolean
        updateFlowStatus: Boolean
        requestOtp: Boolean
        verifyOtp: Boolean
        loginWithSgid: Boolean
        loginWithSelectedSgid: Boolean
        startSsoLogin: Boolean
        loginWithSso: Boolean
        verifyTableViewPassword: Boolean
        admin: Boolean
      }
      type AdminQuery {
        _unused: Boolean
      }
      type AdminMutation {
        _unused: Boolean
      }
    `

    function executableSchema(resolvers: {
      upsertFlowCollaborator: () => boolean
      createFlowTransfer: () => boolean
      deleteFlow: () => boolean
    }) {
      const schema = makeExecutableSchema({
        typeDefs,
        resolvers: {
          Query: { healthcheck: () => true },
          Mutation: resolvers,
        },
      })
      return applyMiddleware(schema, authentication.generate(schema))
    }

    async function runMutation(
      schema: GraphQLSchema,
      fieldName: string,
      contextValue: Record<string, unknown>,
    ) {
      const field = schema.getMutationType()?.getFields()[fieldName]
      if (!field?.resolve) {
        throw new Error(`Missing resolver for ${fieldName}`)
      }
      return field.resolve(null, {}, contextValue, {
        fieldName,
      } as GraphQLResolveInfo)
    }

    it('allows an admin operation to upsert a flow collaborator', async () => {
      const upsertFlowCollaborator = vi.fn(() => true)
      const schema = executableSchema({
        upsertFlowCollaborator,
        createFlowTransfer: () => true,
        deleteFlow: () => true,
      })

      const result = await runMutation(schema, 'upsertFlowCollaborator', {
        currentUser: { id: 'admin-user' },
        isAdminOperation: true,
      })

      expect(result).toBe(true)
      expect(upsertFlowCollaborator).toHaveBeenCalledOnce()
    })

    it('still blocks other mutations for an admin operation', async () => {
      const deleteFlow = vi.fn(() => true)
      const schema = executableSchema({
        upsertFlowCollaborator: () => true,
        createFlowTransfer: () => true,
        deleteFlow,
      })

      const result = await runMutation(schema, 'deleteFlow', {
        currentUser: { id: 'admin-user' },
        isAdminOperation: true,
      })

      expect(result).toBeInstanceOf(UnauthorisedError)
      expect(deleteFlow).not.toHaveBeenCalled()
    })
  })
})
