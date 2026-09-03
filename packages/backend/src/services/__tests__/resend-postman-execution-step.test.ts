import { beforeEach, describe, expect, it, vi } from 'vitest'

import PartialStepError from '@/errors/partial-error'
import RetriableError from '@/errors/retriable-error'

import {
  ResendPostmanStepError,
  resendPostmanExecutionStepById,
} from '../resend-postman-execution-step'

const mocks = vi.hoisted(() => {
  const run = vi.fn()
  const getApp = vi.fn(async () => ({
    key: 'postman',
    apiBaseUrl: 'https://api.postman.gov.sg',
  }))
  const relatedQuery = vi.fn(async () => null)
  const globalVariable = vi.fn()
  const findById = vi.fn()

  return { run, getApp, relatedQuery, globalVariable, findById }
})

vi.mock('@/apps/postman/actions/send-transactional-email', () => ({
  default: {
    run: mocks.run,
  },
}))

vi.mock('@/helpers/global-variable', () => ({
  default: mocks.globalVariable,
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/models/execution-step', () => ({
  default: {
    query: vi.fn(() => ({
      findById: mocks.findById,
    })),
  },
}))

function mockQueryResult(executionStep: unknown) {
  mocks.findById.mockReturnValue({
    withGraphFetched: vi.fn(() => ({
      withSoftDeleted: vi.fn(async () => executionStep),
    })),
  })
}

function makeExecutionStep(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    appKey: 'postman',
    key: 'sendTransactionalEmail',
    status: 'success',
    dataIn: {
      destinationEmail: 'user@open.gov.sg',
      subject: 'Original subject',
      body: 'Original body',
      senderName: 'Plumber',
    },
    metadata: {},
    execution: {
      id: '22222222-2222-2222-2222-222222222222',
      testRun: false,
      flow: {
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Test flow',
        user: { email: 'owner@open.gov.sg' },
      },
    },
    step: {
      id: '44444444-4444-4444-4444-444444444444',
      getApp: mocks.getApp,
      $relatedQuery: mocks.relatedQuery,
    },
    ...overrides,
  }
}

describe('resendPostmanExecutionStepById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.globalVariable.mockImplementation(async () => ({
      step: { parameters: {} },
      actionOutput: { data: { raw: null } },
      getLastExecutionStep: vi.fn(),
    }))
    mocks.run.mockResolvedValue(undefined)
    mocks.getApp.mockResolvedValue({
      key: 'postman',
      apiBaseUrl: 'https://api.postman.gov.sg',
    })
    mocks.relatedQuery.mockResolvedValue(null)
  })

  it('sends using stored data_in and ignores last execution step', async () => {
    mockQueryResult(makeExecutionStep())
    const $ = {
      step: { parameters: { destinationEmail: 'stale@open.gov.sg' } },
      actionOutput: {
        data: {
          raw: { status: ['ACCEPTED'], recipient: ['user@open.gov.sg'] },
        },
      },
      getLastExecutionStep: vi.fn(),
    }
    mocks.globalVariable.mockResolvedValue($)
    mocks.run.mockImplementation(async (globalVar) => {
      globalVar.actionOutput.data = {
        raw: { status: ['ACCEPTED'], recipient: ['user@open.gov.sg'] },
      }
    })

    const result = await resendPostmanExecutionStepById(
      '11111111-1111-1111-1111-111111111111',
    )

    expect($.step.parameters).toEqual({
      destinationEmail: 'user@open.gov.sg',
      subject: 'Original subject',
      body: 'Original body',
      senderName: 'Plumber',
    })
    expect(await $.getLastExecutionStep()).toBeUndefined()
    expect(result.error).toBeNull()
    expect(result.dataOut).toEqual({
      status: ['ACCEPTED'],
      recipient: ['user@open.gov.sg'],
    })
    expect(mocks.run).toHaveBeenCalledOnce()
  })

  it('does not send on dry run', async () => {
    mockQueryResult(makeExecutionStep())

    const result = await resendPostmanExecutionStepById(
      '11111111-1111-1111-1111-111111111111',
      { dryRun: true },
    )

    expect(result.dryRun).toBe(true)
    expect(result.destinationEmail).toBe('user@open.gov.sg')
    expect(mocks.run).not.toHaveBeenCalled()
    expect(mocks.globalVariable).not.toHaveBeenCalled()
  })

  it('retries RetriableError then succeeds', async () => {
    mockQueryResult(makeExecutionStep())
    const sleep = vi.fn().mockResolvedValue(undefined)
    mocks.run
      .mockRejectedValueOnce(
        new RetriableError({
          error: 'rate limited',
          delayInMs: 10,
          delayType: 'step',
        }),
      )
      .mockResolvedValueOnce(undefined)

    const result = await resendPostmanExecutionStepById(
      '11111111-1111-1111-1111-111111111111',
      { sleep, maxAttempts: 3 },
    )

    expect(result.error).toBeNull()
    expect(mocks.run).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(10)
  })

  it('returns partial success without throwing', async () => {
    mockQueryResult(makeExecutionStep())
    mocks.run.mockRejectedValue(
      new PartialStepError({
        name: 'Blacklisted recipient email',
        solution: 'Remove the recipient',
        partialRetry: { buttonMessage: 'Retry' },
      }),
    )

    const result = await resendPostmanExecutionStepById(
      '11111111-1111-1111-1111-111111111111',
    )

    expect(result.error).toContain('Blacklisted recipient email')
  })

  it.each([
    {
      name: 'missing row',
      row: null,
      message: 'was not found',
    },
    {
      name: 'wrong app',
      row: makeExecutionStep({ appKey: 'slack' }),
      message: 'not a Postman send-email action',
    },
    {
      name: 'failed status',
      row: makeExecutionStep({ status: 'failure' }),
      message: 'not success',
    },
    {
      name: 'missing data_in',
      row: makeExecutionStep({ dataIn: null }),
      message: 'has no data_in',
    },
    {
      name: 'test run',
      row: makeExecutionStep({
        execution: {
          id: '22222222-2222-2222-2222-222222222222',
          testRun: true,
          flow: {
            id: '33333333-3333-3333-3333-333333333333',
            user: { email: 'owner@open.gov.sg' },
          },
        },
      }),
      message: 'test run',
    },
  ])('rejects $name', async ({ row, message }) => {
    mockQueryResult(row)

    await expect(
      resendPostmanExecutionStepById('11111111-1111-1111-1111-111111111111'),
    ).rejects.toBeInstanceOf(ResendPostmanStepError)

    await expect(
      resendPostmanExecutionStepById('11111111-1111-1111-1111-111111111111'),
    ).rejects.toThrow(message)
  })
})
