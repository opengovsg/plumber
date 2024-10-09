import { type IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'

import onlyContinueIfAction from '../../actions/only-continue-if'

const mocks = vi.hoisted(() => ({
  setActionItem: vi.fn(),
  stepQueryResult: vi.fn(),
}))

vi.mock('@/models/step', () => ({
  default: {
    query: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          throwIfNotFound: mocks.stepQueryResult,
        })),
      })),
    })),
  },
}))

const MOCK_FLOW = [
  {
    id: 'trigger',
    appKey: 'formsg',
    key: 'newSubmission',
    position: 1,
  },
  // only continue if before branches
  {
    id: 'test-step',
    appKey: 'toolbox',
    key: onlyContinueIfAction.key,
    position: 2,
  },
  // Branch 1
  {
    id: 'branch-1',
    appKey: 'toolbox',
    key: 'ifThen',
    position: 3,
    parameters: {
      depth: 0,
    },
  },
  // only continue if in branch 1
  {
    id: 'branch-1-only-continue-if',
    appKey: 'toolbox',
    key: onlyContinueIfAction.key,
    position: 4,
  },
  {
    id: 'branch-1-action-2',
    appKey: 'delay',
    key: 'delayFor',
    position: 5,
  },
  {
    id: 'branch-2',
    appKey: 'toolbox',
    key: 'ifThen',
    position: 6,
    parameters: {
      depth: 0,
    },
  },
  // only continue if in branch 2
  {
    id: 'branch-2-only-continue-if',
    appKey: 'toolbox',
    key: onlyContinueIfAction.key,
    position: 7,
  },
  {
    id: 'branch-2-action-1',
    appKey: 'delay',
    key: 'delayUntil',
    position: 8,
  },
]

describe('Only continue if', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      flow: {
        id: 'fake-pipe',
      },
      step: {
        id: 'test-step',
        appKey: 'toolbox',
        key: onlyContinueIfAction.key,
        position: 2,
        parameters: {},
      },
      app: {
        name: 'Toolbox',
      },
      setActionItem: mocks.setActionItem,
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns void if condition passes', async () => {
    $.step.parameters = {
      field: 1,
      is: 'is',
      condition: 'equals',
      text: 1,
    }

    const result = await onlyContinueIfAction.run($)
    expect(result).toBeFalsy()
    expect(mocks.setActionItem).toBeCalledWith({
      raw: { result: true },
    })
  })

  it('stops execution if condition fails before branches', async () => {
    $.step.parameters = {
      field: 1,
      is: 'is',
      condition: 'contains',
      text: 0,
    }

    mocks.stepQueryResult.mockResolvedValueOnce(MOCK_FLOW)

    const result = await onlyContinueIfAction.run($)
    expect(result).toEqual({
      nextStep: { command: 'stop-execution' },
    })
    expect(mocks.setActionItem).toBeCalledWith({
      raw: { result: false },
    })
  })

  it('only continue if in branch 1 jumps to branch 2 if condition fails', async () => {
    // update only continue if to step 4
    $.step = {
      ...MOCK_FLOW[3],
      parameters: {
        field: 1,
        is: 'not',
        condition: 'equals',
        text: 1,
      },
    }

    mocks.stepQueryResult.mockResolvedValueOnce(MOCK_FLOW)

    const result = await onlyContinueIfAction.run($)
    expect(result).toEqual({
      nextStep: { command: 'jump-to-step', stepId: 'branch-2' },
    })
    expect(mocks.setActionItem).toBeCalledWith({
      raw: { result: false },
    })
  })

  it('execution ends when only continue if in last branch fails', async () => {
    // update only continue if to step 7
    $.step = {
      ...MOCK_FLOW[6],
      parameters: {
        field: 1,
        is: 'not',
        condition: 'equals',
        text: 1,
      },
    }

    mocks.stepQueryResult.mockResolvedValueOnce(MOCK_FLOW)

    const result = await onlyContinueIfAction.run($)
    expect(result).toEqual({
      nextStep: { command: 'stop-execution' },
    })
    expect(mocks.setActionItem).toBeCalledWith({
      raw: { result: false },
    })
  })

  it('should throw step error if invalid condition is configured', async () => {
    const invalidCondition = '==='
    $.step.parameters = {
      field: 1,
      is: 'is',
      condition: invalidCondition,
      text: 0,
    }

    // throw partial step error message
    await expect(onlyContinueIfAction.run($)).rejects.toThrowError(
      `Conditional logic block contains an unknown operator: ${invalidCondition}`,
    )
  })

  it('returns void if field is empty', async () => {
    $.step.parameters = {
      field: '',
      is: 'is',
      condition: 'empty',
    }

    const result = await onlyContinueIfAction.run($)
    expect(result).toBeFalsy()
    expect(mocks.setActionItem).toBeCalledWith({
      raw: { result: true },
    })
  })

  it.each([
    { field: 123, is: 'is', condition: 'gte', text: 123 },
    { field: 123, is: 'is', condition: 'gt', text: 122 },
    { field: 123, is: 'is', condition: 'lte', text: 123 },
    { field: 123, is: 'is', condition: 'lt', text: 124 },
    { field: 123, is: 'not', condition: 'lt', text: 123 },
  ])(
    'returns void if numbers are used for operator comparison',
    async ({ field, is, condition, text }) => {
      $.step.parameters = {
        field,
        is,
        condition,
        text,
      }

      const result = await onlyContinueIfAction.run($)
      expect(result).toBeFalsy()
      expect(mocks.setActionItem).toBeCalledWith({
        raw: { result: true },
      })
    },
  )

  it('should throw step error if a non-number is used for operator comparison', async () => {
    $.step.parameters = {
      field: 123,
      is: 'is',
      condition: 'gte',
      text: '19 Nov 2021',
    }

    await expect(onlyContinueIfAction.run($)).rejects.toThrowError(StepError)
  })
})
