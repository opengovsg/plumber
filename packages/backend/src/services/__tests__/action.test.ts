import { IFlowConfig, IGlobalVariable } from '@plumber/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import StepError from '@/errors/step'

import { processAction, setActionOutputError } from '../action'

const mocks = vi.hoisted(() => {
  const executionStep = {
    id: 'exec-step-id',
    isFailed: false,
    status: 'success',
  }
  const execution = {
    id: 'execution-id',
    $relatedQuery: vi.fn(() => ({
      insertAndFetch: vi.fn(() => ({
        onConflict: vi.fn(() => ({
          ignore: vi.fn(() => () => executionStep),
        })),
      })),
    })),
  }
  const step = {
    id: 'step-id',
    appKey: 'webhook',
    parameters: {},
    key: 'new-submission',
    config: {},
    getApp: vi.fn(() => ({ key: 'webhook' })),
    getActionCommand: vi.fn(() => ({
      run: vi.fn(),
      preprocessVariable: undefined,
    })),
    getNextStep: vi.fn(() => null),
    $relatedQuery: vi.fn(() => null),
  }
  const flow = {
    id: 'flow-id',
    config: null as IFlowConfig | null,
    user: { email: 'test@example.com' },
    steps: [] as unknown[],
  }

  return {
    step,
    flow,
    execution,
    executionStep,
    globalVariable: vi.fn(() => ({
      step: { parameters: {} },
      actionOutput: { data: null, error: null },
      execution: { id: 'execution-id' },
      app: { key: 'webhook' },
    })),
  }
})

vi.mock('@/models/step', () => ({
  default: {
    query: vi.fn(() => ({
      findById: vi.fn(() => ({
        throwIfNotFound: vi.fn(() => mocks.step),
      })),
    })),
  },
}))

vi.mock('@/models/flow', () => ({
  default: {
    query: vi.fn(() => ({
      findById: vi.fn(() => ({
        withGraphJoined: vi.fn(() => ({
          withGraphFetched: vi.fn(() => ({
            throwIfNotFound: vi.fn(() => mocks.flow),
          })),
        })),
      })),
    })),
  },
}))

vi.mock('@/models/execution', () => ({
  default: {
    query: vi.fn(() => ({
      findById: vi.fn(() => ({
        throwIfNotFound: vi.fn(() => mocks.execution),
      })),
    })),
  },
}))

vi.mock('@/models/execution-step', () => {
  const chainable: Record<string, unknown> = {}
  chainable.where = vi.fn(() => chainable)
  chainable.then = (onFulfilled: (value: unknown[]) => unknown) =>
    onFulfilled([])
  return {
    default: {
      query: vi.fn(() => chainable),
    },
  }
})

vi.mock('@/helpers/compute-for-each-parameters', () => ({
  getStepContext: vi.fn(() => ({
    forEachStepPosition: -1,
    stepPositions: [],
    isForEachStep: false,
    isLastStep: false,
  })),
}))

vi.mock('@/helpers/compute-parameters', () => ({
  default: vi.fn(() => ({})),
}))

vi.mock('@/helpers/global-variable', () => ({
  default: mocks.globalVariable,
}))

vi.mock('@/helpers/logger', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

vi.mock('@/services/helpers/get-for-each-metadata', () => ({
  default: vi.fn(),
}))

vi.mock('@/queues/action', () => ({
  enqueueActionJob: vi.fn(),
}))

vi.mock('@/helpers/distributed-lock', () => ({
  withLock: vi.fn(
    (
      lockKey: string,
      _fn: unknown,
      opts: { onContention: (lockKey: string) => unknown },
    ) => opts.onContention(lockKey),
  ),
}))

const OPTIONS = {
  flowId: 'flow-id',
  stepId: 'step-id',
  executionId: 'execution-id',
}

describe('processAction', () => {
  beforeEach(() => {
    mocks.flow.config = null
    mocks.executionStep.isFailed = false
    mocks.executionStep.status = 'success'
  })

  describe('Force clogging', () => {
    it('throws an UnrecoverableError when flow.config.isForceClogged is true', async () => {
      mocks.flow.config = { isForceClogged: true }

      await expect(processAction(OPTIONS)).rejects.toThrow(
        'Pipe flow-id has been force clogged',
      )
    })

    it('does not throw UnrecoverableError when flow.config.isForceClogged is false', async () => {
      mocks.flow.config = { isForceClogged: false }

      const result = await processAction(OPTIONS)
      expect(result.executionError).toBeNull()
    })

    it('does not throw error when flow has no config', async () => {
      mocks.flow.config = null

      const result = await processAction(OPTIONS)
      expect(result.executionError).toBeNull()
    })
  })

  describe('Action run', () => {
    it('runs the action as a method of its action command', async () => {
      const actionCommand = {
        run: vi.fn(function (this: unknown) {
          if (this !== actionCommand) {
            throw new Error('run was called without its action command')
          }
        }),
        preprocessVariable: undefined as undefined,
      }
      mocks.step.getActionCommand.mockReturnValueOnce(actionCommand)

      const result = await processAction(OPTIONS)

      expect(actionCommand.run).toHaveBeenCalledOnce()
      expect(result.executionError).toBeNull()
    })
  })

  describe('Test run file lock contention', () => {
    it('records an internal StepError', async () => {
      mocks.globalVariable.mockReturnValueOnce({
        step: { parameters: {} },
        actionOutput: { data: null, error: null },
        execution: { id: 'execution-id' },
        app: {
          key: 'webhook',
          queue: { getLockKey: () => 'lock-key' },
        },
      } as unknown as ReturnType<typeof mocks.globalVariable>)

      const result = await processAction({ ...OPTIONS, testRun: true })

      expect(result.executionError).toBeInstanceOf(StepError)
      expect(result.executionError).toMatchObject({ kind: 'internal' })
    })
  })
})

describe('setActionOutputError', () => {
  function makeGlobalVariable(): IGlobalVariable {
    return {
      actionOutput: { data: null, error: null },
    } as unknown as IGlobalVariable
  }

  it.each<[string, Error]>([
    [
      'an array',
      z.object({ a: z.string() }).safeParse(undefined).error as z.ZodError,
    ],
    ['a number', new Error('404')],
    ['a string', new Error('"x"')],
    ['null', new Error('null')],
  ])('stores the raw message when it parses to %s', (_, error: Error) => {
    const $ = makeGlobalVariable()

    setActionOutputError($, error)

    expect($.actionOutput.error).toEqual({ error: error.message })
  })

  it('stores the parsed object when the message is a JSON object', () => {
    const $ = makeGlobalVariable()
    const error = new StepError({
      name: 'Bad input',
      solution: 'Fix it',
      kind: 'config',
    })

    setActionOutputError($, error)

    expect($.actionOutput.error).toEqual(JSON.parse(error.message))
  })

  it.each([
    ['an object', { a: 1 }],
    ['an array', [1]],
  ])('drops a parsed message field that is %s', (_, message: unknown) => {
    const $ = makeGlobalVariable()

    setActionOutputError(
      $,
      new Error(JSON.stringify({ message, kind: 'internal' })),
    )

    expect($.actionOutput.error).toEqual({ kind: 'internal' })
  })

  it('keeps a parsed message field that is a string', () => {
    const $ = makeGlobalVariable()

    setActionOutputError(
      $,
      new Error(JSON.stringify({ message: 'oops', kind: 'internal' })),
    )

    expect($.actionOutput.error).toEqual({ message: 'oops', kind: 'internal' })
  })
})
