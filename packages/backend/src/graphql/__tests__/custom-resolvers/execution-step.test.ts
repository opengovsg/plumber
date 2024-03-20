import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import resolver from '@/graphql/custom-resolvers/execution-step'
import ExecutionStep from '@/models/execution-step'

const mocks = vi.hoisted(() => ({
  $relatedQuery: vi.fn(),
  triggers: [
    {
      key: 'trigger1',
      getDataOutMetadata: (_: any) => ({
        stringField: 'trigger1-metadata',
      }),
    },
    {
      key: 'trigger2',
      getDataOutMetadata: (_: any) => ({
        stringField: 'trigger2-metadata',
      }),
    },
  ],
  actions: [
    {
      key: 'action1',
      getDataOutMetadata: (_: any) => ({
        stringField: 'action1-metadata',
      }),
    },
    {
      key: 'action2',
      getDataOutMetadata: (_: any) => ({
        stringField: 'action2-metadata',
      }),
    },
  ],
}))

vi.mock('@/models/app', () => ({
  default: {
    findOneByKey: () => ({
      triggers: mocks.triggers,
      actions: mocks.actions,
    }),
  },
}))

describe('execution step', () => {
  let executionStep: ExecutionStep

  beforeEach(() => {
    executionStep = {
      $relatedQuery: mocks.$relatedQuery,
    } as unknown as ExecutionStep
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('dataOut metadata', () => {
    it('gets metadata from the appropriate trigger', async () => {
      mocks.$relatedQuery.mockReturnValueOnce({
        appKey: 'testApp',
        key: 'trigger1',
        isTrigger: true,
        isAction: false,
      })
      const result = await resolver.dataOutMetadata(executionStep, {}, null)
      expect(result).toEqual({ stringField: 'trigger1-metadata' })
    })

    it('gets metadata from the appropriate action', async () => {
      mocks.$relatedQuery.mockReturnValueOnce({
        appKey: 'testApp',
        key: 'action1',
        isTrigger: false,
        isAction: true,
      })
      const result = await resolver.dataOutMetadata(executionStep, {}, null)
      expect(result).toEqual({ stringField: 'action1-metadata' })
    })

    it.each([true, false])(
      'does not get confused between actions and triggers with the same key',
      async (isTrigger) => {
        mocks.triggers = [
          {
            key: 'same-key',
            getDataOutMetadata: (_: any) => ({
              stringField: 'trigger-metadata',
            }),
          },
        ]
        mocks.actions = [
          {
            key: 'same-key',
            getDataOutMetadata: (_: any) => ({
              stringField: 'action-metadata',
            }),
          },
        ]
        mocks.$relatedQuery.mockReturnValueOnce({
          appKey: 'testApp',
          key: 'same-key',
          isTrigger: isTrigger,
          isAction: !isTrigger,
        })
        const result = await resolver.dataOutMetadata(executionStep, {}, null)
        expect(result).toEqual({
          stringField: isTrigger ? 'trigger-metadata' : 'action-metadata',
        })
      },
    )

    it.each([true, false])(
      'returns null if there is no matching action or trigger',
      async (isTrigger) => {
        mocks.$relatedQuery.mockReturnValueOnce({
          appKey: 'testApp',
          key: 'does-not-exist',
          isTrigger: isTrigger,
          isAction: !isTrigger,
        })
        const result = await resolver.dataOutMetadata(executionStep, {}, null)
        expect(result).toBeNull()
      },
    )
  })
})
