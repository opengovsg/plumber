import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import duplicateFlow from '@/graphql/mutations/duplicate-flow'
import Flow from '@/models/flow'
import Step from '@/models/step'
import type Context from '@/types/express/context'

import { generateMockContext } from './tiles/table.mock'
import { generateMockFlow, generateMockStep } from './flow.mock'

/**
 * Builds a flow with two chained if-then blocks plus a single step after the
 * second block, wiring each branch's step to jump to via stepIdToJumpTo:
 *
 *   trigger (1)
 *   ifThenA (2)  stepIdToJumpTo -> ifThenB
 *   actionA (3)
 *   ifThenB (4)  stepIdToJumpTo -> afterStep
 *   actionB (5)
 *   afterStep (6)
 *
 * Steps are created target-first so the (forward-pointing) ids exist when we
 * wire each pointer.
 */
async function buildFlowWithJumpTargets(
  context: Context,
  flowId: string,
): Promise<{
  afterStep: Step
  ifThenB: Step
  ifThenA: Step
}> {
  const afterStep = await generateMockStep(
    context,
    'sendTransactionalEmail',
    'postman',
    'action',
    flowId,
    6,
  )
  const ifThenB = await generateMockStep(
    context,
    'ifThen',
    'toolbox',
    'action',
    flowId,
    4,
    { depth: 0, branchName: 'B', stepIdToJumpTo: afterStep.id },
  )
  const ifThenA = await generateMockStep(
    context,
    'ifThen',
    'toolbox',
    'action',
    flowId,
    2,
    { depth: 0, branchName: 'A', stepIdToJumpTo: ifThenB.id },
  )
  await generateMockStep(
    context,
    'newSubmission',
    'formsg',
    'trigger',
    flowId,
    1,
  )
  await generateMockStep(
    context,
    'sendTransactionalEmail',
    'postman',
    'action',
    flowId,
    3,
  )
  await generateMockStep(
    context,
    'sendTransactionalEmail',
    'postman',
    'action',
    flowId,
    5,
  )

  return { afterStep, ifThenB, ifThenA }
}

function jumpTarget(step: Step): unknown {
  return (step.parameters as Record<string, unknown>)?.stepIdToJumpTo
}

describe('duplicateFlow mutation - stepIdToJumpTo remapping', () => {
  let context: Context
  const flowId = randomUUID()

  beforeEach(async () => {
    context = await generateMockContext()
    await generateMockFlow(context, flowId)
  })

  it('remaps every branch stepIdToJumpTo to the duplicated step ids', async () => {
    const { afterStep, ifThenB, ifThenA } = await buildFlowWithJumpTargets(
      context,
      flowId,
    )

    const duplicatedFlow = await duplicateFlow(
      null,
      { input: { id: flowId } },
      context,
    )

    const newSteps = await Step.query()
      .where('flow_id', duplicatedFlow.id)
      .orderBy('position', 'asc')

    const byPosition = (position: number) =>
      newSteps.find((step) => step.position === position)
    const newIfThenA = byPosition(2)
    const newIfThenB = byPosition(4)
    const newAfterStep = byPosition(6)

    // Each branch now points at the duplicated step, not the original.
    expect(jumpTarget(newIfThenA)).toBe(newIfThenB.id)
    expect(jumpTarget(newIfThenB)).toBe(newAfterStep.id)

    // Sanity: the new ids are genuinely new, so the old targets would dangle.
    expect(newIfThenB.id).not.toBe(ifThenB.id)
    expect(newAfterStep.id).not.toBe(afterStep.id)
    expect(jumpTarget(newIfThenA)).not.toBe(ifThenB.id)
    expect(jumpTarget(newIfThenB)).not.toBe(afterStep.id)

    // Other parameters are preserved.
    expect((newIfThenA.parameters as Record<string, unknown>).branchName).toBe(
      'A',
    )
    expect(ifThenA.position).toBe(2)
  })

  it('leaves legacy if-then steps (no stepIdToJumpTo) without the key', async () => {
    await generateMockStep(
      context,
      'newSubmission',
      'formsg',
      'trigger',
      flowId,
      1,
    )
    await generateMockStep(context, 'ifThen', 'toolbox', 'action', flowId, 2, {
      depth: 0,
      branchName: 'legacy',
    })

    const duplicatedFlow = await duplicateFlow(
      null,
      { input: { id: flowId } },
      context,
    )

    const newIfThen = (
      await Step.query()
        .where('flow_id', duplicatedFlow.id)
        .orderBy('position', 'asc')
    ).find((step) => step.position === 2)

    expect(
      'stepIdToJumpTo' in (newIfThen.parameters as Record<string, unknown>),
    ).toBe(false)
  })

  it('does not mutate the original flow', async () => {
    const { ifThenB, ifThenA } = await buildFlowWithJumpTargets(context, flowId)

    await duplicateFlow(null, { input: { id: flowId } }, context)

    const originalIfThenA = await Step.query().findById(ifThenA.id)
    expect(jumpTarget(originalIfThenA)).toBe(ifThenB.id)
  })

  it('throws and rolls back if a branch stepIdToJumpTo dangles', async () => {
    const danglingId = randomUUID()
    await generateMockStep(
      context,
      'newSubmission',
      'formsg',
      'trigger',
      flowId,
      1,
    )
    await generateMockStep(context, 'ifThen', 'toolbox', 'action', flowId, 2, {
      depth: 0,
      branchName: 'dangling',
      stepIdToJumpTo: danglingId,
    })

    await expect(
      duplicateFlow(null, { input: { id: flowId } }, context),
    ).rejects.toThrow('Could not remap stepIdToJumpTo')

    // The rolled-back transaction leaves no duplicated flow behind.
    const copies = await Flow.query().where('name', '[COPY] Test Flow')
    expect(copies).toHaveLength(0)
  })
})
