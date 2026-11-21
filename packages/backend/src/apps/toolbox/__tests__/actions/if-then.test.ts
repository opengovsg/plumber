import { type IGlobalVariable, type IJSONObject } from '@plumber/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import toolboxApp from '../..'
import ifThenAction from '../../actions/if-then'

// Wraps a single condition row into the v2 grouped shape (one OR-group).
function singleGroup(row: IJSONObject) {
  return [{ rows: [row] }]
}

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
    vi.clearAllMocks()
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
      $.step.parameters.conditions = singleGroup({
        field: 1,
        is: 'is',
        condition: 'equals',
        text: 1,
      })
      const result = await ifThenAction.run!($)

      expect(result).toBeFalsy()
      expect(mocks.setActionItem).toHaveBeenCalledWith({
        raw: { isConditionMet: true },
      })
    })

    it('takes the branch when any OR-group passes', async () => {
      $.step.parameters.conditions = [
        { rows: [{ field: 1, is: 'is', condition: 'equals', text: 9999 }] },
        { rows: [{ field: 1, is: 'is', condition: 'equals', text: 1 }] },
      ]
      const result = await ifThenAction.run!($)

      expect(result).toBeFalsy()
      expect(mocks.setActionItem).toHaveBeenCalledWith({
        raw: { isConditionMet: true },
      })
    })

    it('AND-s rows within a group (all rows must pass)', async () => {
      $.step.parameters.conditions = [
        {
          rows: [
            { field: 1, is: 'is', condition: 'equals', text: 1 },
            { field: 'a', is: 'is', condition: 'equals', text: 'b' },
          ],
        },
      ]
      const result = await ifThenAction.run!($)

      expect(result).toEqual({
        nextStep: { command: 'jump-to-step', stepId: 'branch-2' },
      })
      expect(mocks.setActionItem).toHaveBeenCalledWith({
        raw: { isConditionMet: false },
      })
    })

    it('skips to the next branch if branch condition fails and there is a next branch', async () => {
      $.step.parameters.conditions = singleGroup({
        field: 1,
        is: 'is',
        condition: 'equals',
        text: 9999,
      })
      const result = await ifThenAction.run!($)

      expect(result).toEqual({
        nextStep: { command: 'jump-to-step', stepId: 'branch-2' },
      })
      expect(mocks.setActionItem).toHaveBeenCalledWith({
        raw: { isConditionMet: false },
      })
    })

    it('ends the pipe if branch condition fails and there is no next branch', async () => {
      $.step.parameters.conditions = singleGroup({
        field: 1,
        is: 'is',
        condition: 'equals',
        text: 9999,
      })
      // Exclude all of branch-2 from pipe for this test. getStepIdToSkipTo
      // pre-queries to read the step's config, then the legacy engine queries
      // again on the marker-less path — so both reads need the same steps.
      mocks.stepQueryResult.mockResolvedValue(FLAT_PIPE_STEPS.slice(0, 3))
      const result = await ifThenAction.run!($)

      expect(result).toEqual({
        nextStep: { command: 'stop-execution' },
      })
      expect(mocks.setActionItem).toHaveBeenCalledWith({
        raw: { isConditionMet: false },
      })
    })

    it('treats missing conditions as not met and skips to the next branch', async () => {
      // The evaluator is strict but defensive: missing conditions evaluate to
      // false rather than throwing (empty conditions are caught by frontend
      // "Check step" validation and the incomplete-step activation guard).
      delete $.step.parameters.conditions
      const result = await ifThenAction.run!($)

      expect(result).toEqual({
        nextStep: { command: 'jump-to-step', stepId: 'branch-2' },
      })
      expect(mocks.setActionItem).toHaveBeenCalledWith({
        raw: { isConditionMet: false },
      })
    })

    it('should throw step error if invalid condition is configured', async () => {
      const invalidCondition = '==='
      $.step.parameters.conditions = singleGroup({
        field: 1,
        is: 'is',
        condition: invalidCondition,
        text: 9999,
      })

      // throw partial step error message
      await expect(ifThenAction.run!($)).rejects.toThrow(
        `Conditional logic block contains an unknown operator: ${invalidCondition}`,
      )
      await expect(ifThenAction.run!($)).rejects.toMatchObject({
        kind: 'internal',
      })
    })

    it('marks an invalid date in the field as a config error', async () => {
      $.step.parameters.conditions = singleGroup({
        field: '',
        is: 'is',
        condition: 'before',
        text: '04 Nov 2024',
      })

      await expect(ifThenAction.run!($)).rejects.toMatchObject({
        kind: 'config',
        message: expect.stringContaining(
          'Error in condition group 1: Invalid date used in field for comparison',
        ),
      })
    })

    it.each([
      { field: 'Hello', text: 'He', expectedResult: true },
      { field: 'Hello', text: 'Me', expectedResult: false },
      { field: 123, text: '12', expectedResult: true },
      { field: 123, text: '32', expectedResult: false },
    ])(
      'should handle begins with condition',
      async ({ field, text, expectedResult }) => {
        $.step.parameters.conditions = singleGroup({
          field,
          is: 'is',
          condition: 'begins',
          text,
        })

        await ifThenAction.run!($)
        expect(mocks.setActionItem).toHaveBeenCalledWith({
          raw: { isConditionMet: expectedResult },
        })
      },
    )
  })
})
