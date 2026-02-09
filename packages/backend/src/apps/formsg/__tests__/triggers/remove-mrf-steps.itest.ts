import { beforeEach, describe, expect, it, vi } from 'vitest'

import Step from '@/models/step'
import type Context from '@/types/express/context'

import { removeMrfSteps } from '../../triggers/new-submission/remove-mrf-steps'
import {
  createMrfActionStep,
  createMrfTriggerStep,
  createNormalActionStep,
  createRejectBranchStep,
  generateMockContext,
  generateMockFlow,
} from '../mrf.mock'

const FLOW_ID = '00000000-0000-0000-0000-000000000001'
const OTHER_FLOW_ID = '00000000-0000-0000-0000-000000000002'

describe('removeMrfSteps', () => {
  let context: Context

  beforeEach(async () => {
    vi.resetAllMocks()
    context = await generateMockContext()
    await generateMockFlow(context, FLOW_ID)
  })

  async function getStepsByFlow(flowId: string) {
    return Step.query().where('flow_id', flowId).orderBy('position', 'asc')
  }

  it('should delete all MRF action steps', async () => {
    await createMrfTriggerStep({ context, flowId: FLOW_ID })
    await createMrfActionStep({ context, flowId: FLOW_ID, position: 2 })
    await createMrfActionStep({ context, flowId: FLOW_ID, position: 3 })

    await removeMrfSteps(FLOW_ID)

    const steps = await getStepsByFlow(FLOW_ID)
    const mrfSteps = steps.filter((s) => s.key === 'mrfSubmission')
    expect(mrfSteps).toHaveLength(0)
  })

  it('should reset trigger step parameters to empty object (mrf to normal trigger)', async () => {
    const trigger = await createMrfTriggerStep({ context, flowId: FLOW_ID })
    await createMrfActionStep({ context, flowId: FLOW_ID, position: 2 })

    // Verify trigger has MRF parameters before removal
    expect(trigger.parameters.mrf).toBeDefined()

    await removeMrfSteps(FLOW_ID)

    const updatedTrigger = await Step.query().findById(trigger.id)
    expect(updatedTrigger.parameters).toEqual({})
  })

  it('should delete reject branch steps', async () => {
    await createMrfTriggerStep({ context, flowId: FLOW_ID })
    const mrfStep = await createMrfActionStep({
      context,
      flowId: FLOW_ID,
      position: 2,
    })
    await createRejectBranchStep({
      context,
      flowId: FLOW_ID,
      position: 3,
      linkedStepId: mrfStep.id,
    })

    await removeMrfSteps(FLOW_ID)

    const steps = await getStepsByFlow(FLOW_ID)
    // Only trigger should remain
    expect(steps).toHaveLength(1)
    expect(steps[0].key).toBe('newSubmission')
  })

  it('should preserve non-MRF, non-reject action steps', async () => {
    await createMrfTriggerStep({ context, flowId: FLOW_ID })
    await createMrfActionStep({ context, flowId: FLOW_ID, position: 2 })
    const normalStep = await createNormalActionStep({
      context,
      flowId: FLOW_ID,
      position: 3,
    })
    const mrfStep2 = await createMrfActionStep({
      context,
      flowId: FLOW_ID,
      position: 4,
    })
    await createRejectBranchStep({
      context,
      flowId: FLOW_ID,
      position: 5,
      linkedStepId: mrfStep2.id,
    })

    await removeMrfSteps(FLOW_ID)

    const steps = await getStepsByFlow(FLOW_ID)
    // Trigger + normal action step should remain
    expect(steps).toHaveLength(2)
    expect(steps[0].key).toBe('newSubmission')
    expect(steps[1].id).toBe(normalStep.id)
  })

  it('should reset step ordering after deletions', async () => {
    await createMrfTriggerStep({ context, flowId: FLOW_ID })
    await createMrfActionStep({ context, flowId: FLOW_ID, position: 2 })
    await createNormalActionStep({ context, flowId: FLOW_ID, position: 3 })
    await createMrfActionStep({ context, flowId: FLOW_ID, position: 4 })
    await createNormalActionStep({ context, flowId: FLOW_ID, position: 5 })

    await removeMrfSteps(FLOW_ID)

    const steps = await getStepsByFlow(FLOW_ID)
    // Trigger (pos 1) + 2 normal actions (pos 2, 3)
    expect(steps).toHaveLength(3)
    expect(steps.map((s) => s.position)).toEqual([1, 2, 3])
  })

  it('should work when trx is provided', async () => {
    await createMrfTriggerStep({ context, flowId: FLOW_ID })
    await createMrfActionStep({ context, flowId: FLOW_ID, position: 2 })
    const normalStep = await createNormalActionStep({
      context,
      flowId: FLOW_ID,
      position: 3,
    })

    await Step.transaction(async (trx) => {
      await removeMrfSteps(FLOW_ID, trx)
    })

    const steps = await getStepsByFlow(FLOW_ID)
    expect(steps).toHaveLength(2)
    expect(steps[0].key).toBe('newSubmission')
    expect(steps[1].id).toBe(normalStep.id)
    expect(steps[1].position).toBe(2)
  })

  it('should not affect steps belonging to other flows', async () => {
    await generateMockFlow(context, OTHER_FLOW_ID)

    // Set up flow 1
    await createMrfTriggerStep({ context, flowId: FLOW_ID })
    await createMrfActionStep({ context, flowId: FLOW_ID, position: 2 })

    // Set up flow 2
    await createMrfTriggerStep({ context, flowId: OTHER_FLOW_ID })
    await createMrfActionStep({ context, flowId: OTHER_FLOW_ID, position: 2 })

    await removeMrfSteps(FLOW_ID)

    // Flow 1 should have MRF steps removed
    const flow1Steps = await getStepsByFlow(FLOW_ID)
    expect(flow1Steps).toHaveLength(1)
    expect(flow1Steps[0].key).toBe('newSubmission')

    // Flow 2 should be untouched
    const flow2Steps = await getStepsByFlow(OTHER_FLOW_ID)
    expect(flow2Steps).toHaveLength(2)
    expect(flow2Steps[1].key).toBe('mrfSubmission')
  })

  it('should handle flow with no MRF steps gracefully', async () => {
    await createMrfTriggerStep({ context, flowId: FLOW_ID, parameters: {} })
    await createNormalActionStep({ context, flowId: FLOW_ID, position: 2 })

    await removeMrfSteps(FLOW_ID)

    const steps = await getStepsByFlow(FLOW_ID)
    // Trigger + normal action still present
    expect(steps).toHaveLength(2)
    // Trigger parameters should be reset to {}
    expect(steps[0].parameters).toEqual({})
  })
})
