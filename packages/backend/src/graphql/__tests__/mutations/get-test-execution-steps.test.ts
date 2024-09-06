import { describe, expect, it, vi } from 'vitest'

import getTestExecutionSteps from '@/graphql/queries/get-test-execution-steps'
import type Context from '@/types/express/context'

const context = {
  currentUser: {
    $relatedQuery: vi.fn(() => {
      return {
        withGraphFetched: vi.fn(() => {
          return {
            findById: vi.fn(() => {
              return {
                throwIfNotFound: vi.fn(() => {
                  return {
                    id: 'flow-id',
                    steps: [
                      {
                        id: 'step-id-1',
                        status: 'completed',
                      },
                      {
                        id: 'step-id-2',
                        status: 'incomplete',
                      },
                      {
                        id: 'step-id-3',
                        status: 'incomplete',
                      },
                      {
                        id: 'step-id-4',
                        status: 'completed',
                      },
                    ],
                  }
                }),
              }
            }),
          }
        }),
      }
    }),
  },
} as unknown as Context

vi.mock('@/helpers/get-test-execution-steps', () => ({
  getTestExecutionSteps: vi.fn(() => {
    return [
      {
        isFailed: false,
        stepId: 'step-id-1',
      },
      {
        isFailed: true,
        stepId: 'step-id-2',
      },
      {
        isFailed: false,
        stepId: 'step-id-3',
      },
      {
        isFailed: true,
        stepId: 'step-id-4',
      },
    ]
  }),
}))

describe('Get test execution steps mutation', () => {
  it('filter out execution steps that belong to incomplete steps', async () => {
    const result = await getTestExecutionSteps(
      {},
      { flowId: 'flow-id' },
      context,
    )
    expect(result.map((r) => r.stepId)).toEqual([
      'step-id-1',
      'step-id-2',
      'step-id-4',
    ])
  })
})
