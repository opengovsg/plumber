import type { IStepConfig } from '@plumber/types'
import { raw, Transaction } from 'objection'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fixupEndStepOnCreateStep } from '@/apps/toolbox/actions/if-then/infra/handle-create-step'
import { BLOCK_END_STEP_ID } from '@/apps/toolbox/common/constants'
import type Flow from '@/models/flow'
import type Step from '@/models/step'

const stepPatchMocks = vi.hoisted(() => ({
  patchCalls: [] as { id: string; patch: unknown }[],
  deleteCalls: [] as string[],
}))

vi.mock('@/models/step', () => ({
  default: {
    query: () => ({
      findById: (id: string) => ({
        patch: (patch: unknown) => {
          stepPatchMocks.patchCalls.push({ id, patch })
          return Promise.resolve()
        },
        delete: () => {
          stepPatchMocks.deleteCalls.push(id)
          return Promise.resolve()
        },
      }),
    }),
  },
}))

type Fixture = {
  id: string
  appKey?: string
  key?: string
  position: number
  config: IStepConfig
}

const trigger = (position: number): Fixture => ({
  id: `trigger${position}`,
  appKey: 'formsg',
  key: 'newSubmission',
  position,
  config: {},
})

const plain = (
  id: string,
  position: number,
  config: IStepConfig = {},
): Fixture => ({
  id,
  appKey: 'postman',
  key: 'sendTransactionalEmail',
  position,
  config,
})

const ifThen = (
  id: string,
  position: number,
  config: IStepConfig = {},
): Fixture => ({
  id,
  appKey: 'toolbox',
  key: 'ifThen',
  position,
  config,
})

const FLOW_ID = 'flow1'

describe('fixupEndStepOnCreateStep', () => {
  const trx = {} as Transaction

  const flowPositionPatchMocks = {
    patchCalls: [] as { threshold: number; patch: unknown }[],
  }

  // `stepsAfterBlankRemoval` stands in for what a real DB re-fetch would
  // return after the blank-cleanup deletes and compacts positions.
  // The mock returns `initialSteps` for the first fetch, then this for every
  // fetch after.
  function fakeFlow(
    initialSteps: Fixture[],
    stepsAfterBlankRemoval: Fixture[] = initialSteps,
  ): Flow {
    const orderByMock = vi
      .fn()
      .mockResolvedValueOnce(initialSteps)
      .mockResolvedValue(stepsAfterBlankRemoval)
    return {
      id: FLOW_ID,
      $relatedQuery: vi.fn(() => ({
        orderBy: orderByMock,
        where: vi.fn((_column: string, _operator: string, value: number) => ({
          patch: vi.fn((patch: unknown) => {
            flowPositionPatchMocks.patchCalls.push({
              threshold: value,
              patch,
            })
            return Promise.resolve()
          }),
        })),
      })),
    } as unknown as Flow
  }

  const pinPatch = (endStepId: string) => ({
    config: raw(`jsonb_set(config, '{${BLOCK_END_STEP_ID}}', ?::jsonb)`, [
      JSON.stringify(endStepId),
    ]),
  })

  const shiftPatch = () => ({ position: raw('position - 1') })

  // A leftover blank child from the V1 branch initializer.
  const blank = (id: string, position: number): Fixture => ({
    id,
    position,
    config: {},
  })

  beforeEach(() => {
    stepPatchMocks.patchCalls.length = 0
    stepPatchMocks.deleteCalls.length = 0
    flowPositionPatchMocks.patchCalls.length = 0
  })

  it('deletes a leftover V1 blank placeholder before pinning a block reached via add-after-block', async () => {
    const block = ifThen('block', 2)
    const blankChild = blank('blankChild', 3)
    const newStep = plain('newStep', 4)
    const flow = fakeFlow(
      [trigger(1), block, blankChild, newStep],
      [trigger(1), block, { ...newStep, position: 3 }],
    )

    await fixupEndStepOnCreateStep({
      trx,
      flow,
      previousBlockId: 'block',
      previousStep: { id: 'blankChild' } as unknown as Step,
      newStep: { id: 'newStep' } as unknown as Step,
      wantsSelfEndStep: false,
    })

    // The placeholder is deleted, so the block (with no other member left)
    // self-references instead of adopting the deleted placeholder as its
    // endStep.
    expect(stepPatchMocks.deleteCalls).toEqual(['blankChild'])
    expect(flowPositionPatchMocks.patchCalls).toEqual([
      { threshold: 3, patch: shiftPatch() },
    ])
    expect(stepPatchMocks.patchCalls).toEqual([
      { id: 'block', patch: pinPatch('block') },
    ])
  })

  it('pins directly to a real last member, with no cleanup, when there is no blank placeholder', async () => {
    const block = ifThen('block', 2)
    const real = plain('real', 3)
    const newStep = plain('newStep', 4)
    const flow = fakeFlow([trigger(1), block, real, newStep])

    await fixupEndStepOnCreateStep({
      trx,
      flow,
      previousBlockId: 'block',
      previousStep: { id: 'real' } as unknown as Step,
      newStep: { id: 'newStep' } as unknown as Step,
      wantsSelfEndStep: false,
    })

    expect(stepPatchMocks.deleteCalls).toEqual([])
    expect(stepPatchMocks.patchCalls).toEqual([
      { id: 'block', patch: pinPatch('real') },
    ])
  })
})
