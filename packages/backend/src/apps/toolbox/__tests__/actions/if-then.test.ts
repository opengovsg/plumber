import { type IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'

import toolboxApp from '../..'
import ifThenAction from '../../actions/if-then'

/**
 * [T = trigger S = normal step, B = branch]
 *
 *   T
 *   |
 *   B1 (branch-1)
 *     \
 *      S1 (branch-1-action-1)
 *     /
 *   B2 (branch-2)
 *     \
 *      S2 (branch-2-action-1)
 */
const FLAT_PIPE_STEPS = [
  {
    id: 'trigger',
    appKey: 'fakeTrigger',
    key: 'nom-nom-nom',
    position: 1,
  },
  // Branch 1 is the default branch under test.
  {
    id: 'branch-1',
    appKey: toolboxApp.key,
    key: ifThenAction.key,
    position: 2,
    parameters: {
      depth: 0,
    },
  },
  {
    id: 'branch-1-action-1',
    appKey: 'coffeeMaker',
    key: 'makeEspresso',
    position: 3,
  },
  {
    id: 'branch-2',
    appKey: toolboxApp.key,
    key: ifThenAction.key,
    position: 4,
    parameters: {
      depth: 0,
    },
  },
  {
    id: 'branch-2-action-1',
    appKey: 'coffeeMaker',
    key: 'makeEspresso',
    position: 5,
  },
]

/**
 * [T = trigger S = normal step, B = branch]
 *
 *   T
 *   |
 *   B1 (branch-1)
 *     \
 *      S1 (branch-1-action-1)
 *      |
 *      B1.1 (branch-1.1)
 *        \
 *         S2 (branch-1.1-action-1)
 *        /
 *      B1.2 (branch-1.2)
 *        \
 *         B1.2.1 (branch-1.2.1)
 *         |
 *         | // Intentionally no action in B1.2.1
 *         |
 *         B1.2.2 (branch-1.2.2)
 *           \
 *            S2 (branch-1.2.2-action-1)
 *           /
 *         /
 *       /
 *     /
 *   B2 (branch-2)
 *     \
 *      S5 (branch-2-action-1)
 *       |
 *      B2.1 (branch-2.1)
 *        \
 *         S6 (branch-2.1-action-1)
 */
const NESTED_BRANCH_PIPE_STEPS = [
  {
    id: 'trigger',
    appKey: 'fakeTrigger',
    key: 'nom-nom-nom',
    position: 1,
  },
  {
    id: 'branch-1',
    appKey: toolboxApp.key,
    key: ifThenAction.key,
    position: 2,
    parameters: {
      depth: 0,
    },
  },
  {
    id: 'branch-1-action-1',
    appKey: 'coffeeMaker',
    key: 'makeEspresso',
    position: 3,
  },
  {
    id: 'branch-1.1',
    appKey: toolboxApp.key,
    key: ifThenAction.key,
    position: 4,
    parameters: {
      depth: 1,
    },
  },
  {
    id: 'branch-1.1-action-1',
    appKey: 'coffeeMaker',
    key: 'makeEspresso',
    position: 5,
  },
  {
    id: 'branch-1.2',
    appKey: toolboxApp.key,
    key: ifThenAction.key,
    position: 6,
    parameters: {
      depth: 1,
    },
  },
  {
    id: 'branch-1.2.1',
    appKey: toolboxApp.key,
    key: ifThenAction.key,
    position: 7,
    parameters: {
      depth: 2,
    },
  },
  {
    id: 'branch-1.2.2',
    appKey: toolboxApp.key,
    key: ifThenAction.key,
    position: 8,
    parameters: {
      depth: 2,
    },
  },
  {
    id: 'branch-1.2.2-action-1',
    appKey: 'coffeeMaker',
    key: 'makeEspresso',
    position: 9,
  },
  {
    id: 'branch-2',
    appKey: toolboxApp.key,
    key: ifThenAction.key,
    position: 10,
    parameters: {
      depth: 0,
    },
  },
  {
    id: 'branch-2-action-1',
    appKey: 'coffeeMaker',
    key: 'makeEspresso',
    position: 11,
  },
  {
    id: 'branch-2.1',
    appKey: toolboxApp.key,
    key: ifThenAction.key,
    position: 12,
    parameters: {
      depth: 1,
    },
  },
  {
    id: 'branch-2.1-action-1',
    appKey: 'coffeeMaker',
    key: 'makeEspresso',
    position: 13,
  },
]

const mocks = vi.hoisted(() => ({
  stepQueryResult: vi.fn(),
  setActionItem: vi.fn(),
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

describe('If-then', () => {
  let $: IGlobalVariable

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('pipes without nested branches', () => {
    beforeEach(() => {
      mocks.stepQueryResult.mockResolvedValue(FLAT_PIPE_STEPS)

      $ = {
        flow: {
          id: 'fake-pipe',
        },
        step: {
          ...FLAT_PIPE_STEPS[1],
        },
        app: {
          name: 'Toolbox',
        },
        setActionItem: mocks.setActionItem,
      } as unknown as IGlobalVariable
    })

    it('runs the branch and returns void if branch condition passes', async () => {
      $.step.parameters.conditions = [
        {
          field: 1,
          is: 'is',
          condition: 'equals',
          text: 1,
        },
      ]
      const result = await ifThenAction.run($)

      expect(result).toBeFalsy()
      expect(mocks.setActionItem).toBeCalledWith({
        raw: { isConditionMet: true },
      })
    })

    it('skips to the next branch if branch condition fails and there is a next branch', async () => {
      $.step.parameters.conditions = [
        {
          field: 1,
          is: 'is',
          condition: 'equals',
          text: 9999,
        },
      ]
      const result = await ifThenAction.run($)

      expect(result).toEqual({
        nextStep: { command: 'jump-to-step', stepId: 'branch-2' },
      })
      expect(mocks.setActionItem).toBeCalledWith({
        raw: { isConditionMet: false },
      })
    })

    it('ends the pipe if branch condition fails and there is no next branch', async () => {
      $.step.parameters.conditions = [
        {
          field: 1,
          is: 'is',
          condition: 'equals',
          text: 9999,
        },
      ]
      // Exclude all of branch-2 from pipe for this test.
      mocks.stepQueryResult.mockResolvedValueOnce(FLAT_PIPE_STEPS.slice(0, 3))
      const result = await ifThenAction.run($)

      expect(result).toEqual({
        nextStep: { command: 'stop-execution' },
      })
      expect(mocks.setActionItem).toBeCalledWith({
        raw: { isConditionMet: false },
      })
    })

    it('should throw step error if no condition is configured', async () => {
      $.step.parameters.conditions = undefined
      await expect(ifThenAction.run($)).rejects.toThrowError(StepError)
    })

    it('should throw step error if invalid condition is configured', async () => {
      const invalidCondition = '==='
      $.step.parameters.conditions = [
        {
          field: 1,
          is: 'is',
          condition: invalidCondition,
          text: 9999,
        },
      ]

      // throw partial step error message
      await expect(ifThenAction.run($)).rejects.toThrowError(
        `Conditional logic block contains an unknown operator: ${invalidCondition}`,
      )
    })
  })

  describe('pipes with nested branches', () => {
    beforeEach(() => {
      mocks.stepQueryResult.mockResolvedValue(NESTED_BRANCH_PIPE_STEPS)

      $ = {
        flow: {
          id: 'fake-pipe',
        },
        step: {
          ...NESTED_BRANCH_PIPE_STEPS[1],
        },
        setActionItem: mocks.setActionItem,
      } as unknown as IGlobalVariable
    })

    it.each([
      // Test depth = 0 branch
      { stepId: 'branch-1' },
      // Test deeper depth
      { stepId: 'branch-1.2.1' },
    ])(
      'runs the branch and returns void if the branch condition passes',
      async () => {
        $.step.parameters.conditions = [
          {
            field: 1,
            is: 'is',
            condition: 'equals',
            text: 1,
          },
        ]
        const result = await ifThenAction.run($)

        expect(result).toBeFalsy()
        expect(mocks.setActionItem).toBeCalledWith({
          raw: { isConditionMet: true },
        })
      },
    )

    it.each([
      { stepId: 'branch-1', expectedNextStepId: 'branch-2' },
      { stepId: 'branch-1.1', expectedNextStepId: 'branch-1.2' },
      { stepId: 'branch-1.2.1', expectedNextStepId: 'branch-1.2.2' },
    ])(
      'skips to the next branch of the same depth if branch condition fails and such a branch exists',
      async ({ stepId, expectedNextStepId }) => {
        // We use stepId instead of index because it's easier to read.
        $.step = {
          ...NESTED_BRANCH_PIPE_STEPS.find((step) => step.id === stepId),
        } as unknown as IGlobalVariable['step']
        $.step.parameters.conditions = [
          {
            field: 1,
            is: 'is',
            condition: 'equals',
            text: 9999,
          },
        ]

        const result = await ifThenAction.run($)

        expect(result).toEqual({
          nextStep: { command: 'jump-to-step', stepId: expectedNextStepId },
        })
        expect(mocks.setActionItem).toBeCalledWith({
          raw: { isConditionMet: false },
        })
      },
    )

    it.each([
      { stepId: 'branch-1.2', expectedNextStepId: 'branch-2' },
      { stepId: 'branch-1.2.2', expectedNextStepId: 'branch-2' },
    ])(
      'skips to a branch of a higher depth if branch condition fails and no branch with the same depth exists',
      async ({ stepId, expectedNextStepId }) => {
        // We use stepId instead of index because it's easier to read.
        $.step = {
          ...NESTED_BRANCH_PIPE_STEPS.find((step) => step.id === stepId),
        } as unknown as IGlobalVariable['step']
        $.step.parameters.conditions = [
          {
            field: 1,
            is: 'is',
            condition: 'equals',
            text: 9999,
          },
        ]

        const result = await ifThenAction.run($)

        expect(result).toEqual({
          nextStep: { command: 'jump-to-step', stepId: expectedNextStepId },
        })
        expect(mocks.setActionItem).toBeCalledWith({
          raw: { isConditionMet: false },
        })
      },
    )

    it.each([
      // Test depth = 0
      { stepId: 'branch-2' },
      // Test deeper depth
      { stepId: 'branch-2.1' },
    ])(
      'ends the pipe if branch condition fails and there is no next branch',
      async ({ stepId }) => {
        $.step = {
          ...NESTED_BRANCH_PIPE_STEPS.find((step) => step.id === stepId),
        } as unknown as IGlobalVariable['step']
        $.step.parameters.conditions = [
          {
            field: 1,
            is: 'is',
            condition: 'equals',
            text: 9999,
          },
        ]

        const result = await ifThenAction.run($)

        expect(result).toEqual({
          nextStep: { command: 'stop-execution' },
        })
        expect(mocks.setActionItem).toBeCalledWith({
          raw: { isConditionMet: false },
        })
      },
    )
  })
})
