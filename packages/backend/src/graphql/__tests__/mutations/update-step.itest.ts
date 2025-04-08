import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BadUserInputError } from '@/errors/graphql-errors'
import updateStep from '@/graphql/mutations/update-step'
import Step from '@/models/step'
import Context from '@/types/express/context'

import { generateMockFlow, generateMockStep } from '../mutations/flow.mock'

import { generateMockContext } from './tiles/table.mock'

const mockConnectionId = '8c2a70d1-e78b-431e-9069-a4d8f97883f5'
const mockFlowId = '8c2a70d1-e78b-431e-9069-a4d8f97883f6'
const mockStepId = '8c2a70d1-e78b-431e-9069-a4d8f97883f7'

describe('updateStep mutation', () => {
  let context: Context
  let patchAndFetchByIdSpy: ReturnType<typeof vi.fn>

  const genericInputParams = {
    id: mockStepId,
    flow: { id: mockFlowId },
    key: 'sendTransactionalEmail',
    appKey: 'postman',
    parameters: { testParam: 'value' },
    connection: { id: mockConnectionId },
  }

  beforeEach(async () => {
    vi.resetAllMocks()
    // Create a mock context with a current user
    context = await generateMockContext()

    // Create a test flow
    await generateMockFlow(context, mockFlowId)

    // Create a test step
    await generateMockStep(
      context,
      'sendTransactionalEmail',
      'postman',
      'action',
      mockFlowId,
      1,
      { testParam: 'value' },
    )

    // Create spy for patchAndFetchById
    patchAndFetchByIdSpy = vi.fn().mockImplementation((id, data) => ({
      id,
      ...data,
      withGraphFetched: vi.fn().mockResolvedValue({
        id,
        ...data,
        connection: { id: mockConnectionId },
      }),
    }))

    // Mock Step.transaction
    vi.spyOn(Step, 'transaction').mockImplementation(async (callback) => {
      const trx = {}
      return callback(trx)
    })

    // Mock Step.query
    vi.spyOn(Step, 'query').mockReturnValue({
      patchAndFetchById: patchAndFetchByIdSpy,
    } as any)

    // Mock context.currentUser.$relatedQuery for steps
    context.currentUser.$relatedQuery = vi
      .fn()
      .mockImplementation((relation) => {
        if (relation === 'steps') {
          return {
            findOne: vi.fn().mockResolvedValue({
              id: mockStepId,
              key: 'sendTransactionalEmail',
              appKey: 'postman',
              status: 'completed',
            }),
          }
        }
        if (relation === 'connections') {
          return {
            findOne: vi
              .fn()
              .mockResolvedValue({ id: mockConnectionId, key: 'postman' }),
          }
        }
        return {
          findOne: vi.fn().mockResolvedValue(null),
        }
      })
  })

  it('should successfully update a step', async () => {
    const input = {
      ...genericInputParams,
      parameters: { updatedParam: 'newValue' },
    }

    await updateStep(null, { input }, context)

    expect(patchAndFetchByIdSpy).toHaveBeenCalledWith(mockStepId, {
      key: 'sendTransactionalEmail',
      appKey: 'postman',
      connectionId: mockConnectionId,
      parameters: { updatedParam: 'newValue' },
      status: 'completed',
      config: {},
    })
  })

  it('should update step with a connection', async () => {
    const connectionId = mockConnectionId
    const input = {
      ...genericInputParams,
      connection: { id: connectionId },
    }

    await updateStep(null, { input }, context)

    expect(patchAndFetchByIdSpy).toHaveBeenCalledWith(mockStepId, {
      key: 'sendTransactionalEmail',
      appKey: 'postman',
      connectionId,
      parameters: { testParam: 'value' },
      status: 'completed',
      config: {},
    })
  })

  it('should throw error if connection not found', async () => {
    const input = {
      ...genericInputParams,
      parameters: { testParam: 'value' },
      connection: { id: 'non-existent-connection' },
    }

    // Override only the connections query
    context.currentUser.$relatedQuery = vi
      .fn()
      .mockImplementation((relation) => {
        if (relation === 'steps') {
          return {
            findOne: vi.fn().mockResolvedValue({
              id: mockStepId,
              key: 'sendTransactionalEmail',
              appKey: 'postman',
              status: 'completed',
            }),
          }
        }
        if (relation === 'connections') {
          return {
            findOne: vi.fn().mockResolvedValue(null),
          }
        }
        return {
          findOne: vi.fn().mockResolvedValue(null),
        }
      })

    await expect(updateStep(null, { input }, context)).rejects.toThrow(
      BadUserInputError,
    )
    expect(patchAndFetchByIdSpy).not.toHaveBeenCalled()
  })

  it('should throw error if step not found', async () => {
    const input = {
      ...genericInputParams,
      id: 'non-existent-step',
    }

    // Override the steps query to return null
    context.currentUser.$relatedQuery = vi
      .fn()
      .mockImplementation((relation) => {
        if (relation === 'steps') {
          return {
            findOne: vi.fn().mockResolvedValue(null),
          }
        }
        if (relation === 'connections') {
          return {
            findOne: vi.fn().mockResolvedValue({ id: mockConnectionId }),
          }
        }
        return {
          findOne: vi.fn().mockResolvedValue(null),
        }
      })

    await expect(updateStep(null, { input }, context)).rejects.toThrow(
      BadUserInputError,
    )
    expect(patchAndFetchByIdSpy).not.toHaveBeenCalled()
  })

  it('should set status to incomplete when key or appKey changes', async () => {
    const input = {
      ...genericInputParams,
      key: 'newKey',
    }

    await updateStep(null, { input }, context)

    expect(patchAndFetchByIdSpy).toHaveBeenCalledWith(mockStepId, {
      key: 'newKey',
      appKey: 'postman',
      connectionId: mockConnectionId,
      parameters: { testParam: 'value' },
      status: 'incomplete',
      config: {},
    })
  })

  it('should set status to incomplete when explicitly requested', async () => {
    const input = {
      ...genericInputParams,
      status: 'incomplete',
    }

    await updateStep(null, { input }, context)

    expect(patchAndFetchByIdSpy).toHaveBeenCalledWith(mockStepId, {
      key: 'sendTransactionalEmail',
      appKey: 'postman',
      connectionId: mockConnectionId,
      parameters: { testParam: 'value' },
      status: 'incomplete',
      config: {},
    })
  })

  it('should update step name', async () => {
    const input = {
      ...genericInputParams,
      config: { stepName: 'Updated Step Name' },
    }

    await updateStep(null, { input }, context)

    expect(patchAndFetchByIdSpy).toHaveBeenCalledWith(mockStepId, {
      key: 'sendTransactionalEmail',
      appKey: 'postman',
      connectionId: mockConnectionId,
      parameters: { testParam: 'value' },
      status: 'completed',
      config: { stepName: 'Updated Step Name' },
    })
  })

  it('updating step name should not update template config', async () => {
    // Override the steps query to return template config
    context.currentUser.$relatedQuery = vi
      .fn()
      .mockImplementation((relation) => {
        if (relation === 'steps') {
          return {
            findOne: vi.fn().mockResolvedValue({
              id: mockStepId,
              key: 'sendTransactionalEmail',
              appKey: 'postman',
              status: 'completed',
              config: {
                stepName: 'some-step-name',
                templateConfig: { appEventKey: 'existingAppEventKey' },
              },
            }),
          }
        }
        if (relation === 'connections') {
          return {
            findOne: vi.fn().mockResolvedValue({ id: mockConnectionId }),
          }
        }
        return {
          findOne: vi.fn().mockResolvedValue(null),
        }
      })

    const input = {
      ...genericInputParams,
      config: { stepName: 'Updated Step Name' },
    }

    await updateStep(null, { input }, context)

    expect(patchAndFetchByIdSpy).toHaveBeenCalledWith(mockStepId, {
      key: 'sendTransactionalEmail',
      appKey: 'postman',
      connectionId: mockConnectionId,
      parameters: { testParam: 'value' },
      status: 'completed',
      config: {
        stepName: 'Updated Step Name',
        templateConfig: { appEventKey: 'existingAppEventKey' },
      },
    })

    // Verify the existing templateConfig was preserved in the result
    expect(
      patchAndFetchByIdSpy.mock.results[0].value.config.templateConfig,
    ).toEqual({
      appEventKey: 'existingAppEventKey',
    })
    expect(patchAndFetchByIdSpy.mock.results[0].value.config.stepName).toEqual(
      'Updated Step Name',
    )
  })
})
