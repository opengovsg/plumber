import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import resolver from '@/graphql/custom-resolvers/execution-step'
import App from '@/models/app'
import ExecutionStep from '@/models/execution-step'

const $relatedQuery = vi.fn()
let triggers = [
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
]
let actions = [
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
]

describe('execution step', () => {
  let executionStep: ExecutionStep

  beforeEach(() => {
    executionStep = {
      $relatedQuery,
      appKey: 'testApp',
    } as unknown as ExecutionStep

    vi.spyOn(App, 'findOneByKey').mockImplementation(
      (async () => ({
        triggers,
        actions,
      })) as never,
    )
  })

  afterEach(() => {
    triggers = [
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
    ]
    actions = [
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
    ]
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('dataOut metadata', () => {
    it('gets metadata from the appropriate trigger', async () => {
      $relatedQuery.mockReturnValueOnce({
        appKey: 'testApp',
        key: 'trigger1',
        isTrigger: true,
        isAction: false,
      })
      const result = await resolver.dataOutMetadata(executionStep, {}, null)
      expect(result).toEqual({ stringField: 'trigger1-metadata' })
    })

    it('gets metadata from the appropriate action', async () => {
      $relatedQuery.mockReturnValueOnce({
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
        triggers = [
          {
            key: 'same-key',
            getDataOutMetadata: (_: any) => ({
              stringField: 'trigger-metadata',
            }),
          },
        ]
        actions = [
          {
            key: 'same-key',
            getDataOutMetadata: (_: any) => ({
              stringField: 'action-metadata',
            }),
          },
        ]
        $relatedQuery.mockReturnValueOnce({
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
        $relatedQuery.mockReturnValueOnce({
          appKey: 'testApp',
          key: 'does-not-exist',
          isTrigger: isTrigger,
          isAction: !isTrigger,
        })
        const result = await resolver.dataOutMetadata(executionStep, {}, null)
        expect(result).toBeNull()
      },
    )

    it('should return null if appKey is different', async () => {
      $relatedQuery.mockReturnValueOnce({
        appKey: 'differentApp',
        key: 'trigger1',
        isTrigger: true,
        isAction: false,
      })
      const result = await resolver.dataOutMetadata(executionStep, {}, null)
      expect(result).toBeNull()
    })
  })
})
