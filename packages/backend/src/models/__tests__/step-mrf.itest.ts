import { beforeEach, describe, expect, it } from 'vitest'

import {
  createMrfActionStep,
  createMrfTriggerStep,
  createNormalActionStep,
  createRejectBranchStep,
  generateMockContext,
  generateMockFlow,
} from '@/apps/formsg/__tests__/mrf.mock'
import Step from '@/models/step'
import type Context from '@/types/express/context'

const FLOW_ID = '00000000-0000-0000-0000-000000000001'

describe('step model - getNextStep MRF branch handling', () => {
  let context: Context

  beforeEach(async () => {
    context = await generateMockContext()
    await generateMockFlow(context, FLOW_ID)
  })

  async function fetchStep(stepId: string): Promise<Step> {
    return Step.query().findById(stepId).throwIfNotFound()
  }

  describe('no branching (normal flow)', () => {
    it('should return the next immediate step when neither step is in a reject branch', async () => {
      await createMrfTriggerStep({ context, flowId: FLOW_ID })
      const step2 = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
      })
      const step3 = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 3,
      })

      const currentStep = await fetchStep(step2.id)
      const nextStep = await currentStep.getNextStep()

      expect(nextStep).toBeDefined()
      expect(nextStep.id).toBe(step3.id)
    })

    it('should return undefined when there is no next step', async () => {
      await createMrfTriggerStep({ context, flowId: FLOW_ID })
      const step2 = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
      })

      const currentStep = await fetchStep(step2.id)
      const nextStep = await currentStep.getNextStep()

      expect(nextStep).toBeUndefined()
    })

    it('should return the next step from trigger to first action', async () => {
      const trigger = await createMrfTriggerStep({ context, flowId: FLOW_ID })
      const step2 = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
      })

      const currentStep = await fetchStep(trigger.id)
      const nextStep = await currentStep.getNextStep()

      expect(nextStep).toBeDefined()
      expect(nextStep.id).toBe(step2.id)
    })
  })

  describe('current step is in rejection branch', () => {
    it('should return the next step if it is also in the same rejection branch', async () => {
      await createMrfTriggerStep({ context, flowId: FLOW_ID })
      const mrfStep = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
      })
      const rejectStep1 = await createRejectBranchStep({
        context,
        flowId: FLOW_ID,
        position: 3,
        linkedStepId: mrfStep.id,
      })
      const rejectStep2 = await createRejectBranchStep({
        context,
        flowId: FLOW_ID,
        position: 4,
        linkedStepId: mrfStep.id,
      })

      const currentStep = await fetchStep(rejectStep1.id)
      const nextStep = await currentStep.getNextStep()

      expect(nextStep).toBeDefined()
      expect(nextStep.id).toBe(rejectStep2.id)
    })

    it('should return undefined if the next step is in a different rejection branch', async () => {
      await createMrfTriggerStep({ context, flowId: FLOW_ID })
      const mrfStep2 = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
      })
      const mrfStep4 = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 4,
      })
      const rejectStepForStep2 = await createRejectBranchStep({
        context,
        flowId: FLOW_ID,
        position: 3,
        linkedStepId: mrfStep2.id,
      })
      // Next position (4) is mrfStep4, which is NOT in the reject branch for mrfStep2
      // But let's set up: position 5 is a reject step for mrfStep4 (different stepId)
      await createRejectBranchStep({
        context,
        flowId: FLOW_ID,
        position: 5,
        linkedStepId: mrfStep4.id,
      })

      // rejectStepForStep2 is at position 3, next position is 4 (mrfStep4, not a reject branch)
      const currentStep = await fetchStep(rejectStepForStep2.id)
      const nextStep = await currentStep.getNextStep()

      // Next immediate step (position 4) is NOT in the same rejection branch
      expect(nextStep).toBeUndefined()
    })

    it('should return undefined when the next step is not in any rejection branch', async () => {
      await createMrfTriggerStep({ context, flowId: FLOW_ID })
      const mrfStep = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
      })
      const rejectStep = await createRejectBranchStep({
        context,
        flowId: FLOW_ID,
        position: 3,
        linkedStepId: mrfStep.id,
      })
      await createNormalActionStep({ context, flowId: FLOW_ID, position: 4 })

      const currentStep = await fetchStep(rejectStep.id)
      const nextStep = await currentStep.getNextStep()

      // Position 4 is a normal step, not a reject branch → undefined
      expect(nextStep).toBeUndefined()
    })

    it('should return undefined when the reject branch step is the last step', async () => {
      await createMrfTriggerStep({ context, flowId: FLOW_ID })
      const mrfStep = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
      })
      const rejectStep = await createRejectBranchStep({
        context,
        flowId: FLOW_ID,
        position: 3,
        linkedStepId: mrfStep.id,
      })

      const currentStep = await fetchStep(rejectStep.id)
      const nextStep = await currentStep.getNextStep()

      expect(nextStep).toBeUndefined()
    })
  })

  describe('current step is NOT in rejection branch, but next step IS', () => {
    it('should skip reject branch steps and return the next MRF action step', async () => {
      await createMrfTriggerStep({ context, flowId: FLOW_ID })
      const mrfStep2 = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
      })
      // Position 3 and 4 are reject branch steps for mrfStep2
      await createRejectBranchStep({
        context,
        flowId: FLOW_ID,
        position: 3,
        linkedStepId: mrfStep2.id,
      })
      await createRejectBranchStep({
        context,
        flowId: FLOW_ID,
        position: 4,
        linkedStepId: mrfStep2.id,
      })
      // Position 5 is the next MRF action step
      const mrfStep5 = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 5,
      })

      const currentStep = await fetchStep(mrfStep2.id)
      const nextStep = await currentStep.getNextStep()

      expect(nextStep).toBeDefined()
      expect(nextStep.id).toBe(mrfStep5.id)
    })

    it('should return undefined when no MRF action step follows the reject branch', async () => {
      await createMrfTriggerStep({ context, flowId: FLOW_ID })
      const mrfStep2 = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
      })
      await createRejectBranchStep({
        context,
        flowId: FLOW_ID,
        position: 3,
        linkedStepId: mrfStep2.id,
      })
      // No more MRF action steps after the reject branch

      const currentStep = await fetchStep(mrfStep2.id)
      const nextStep = await currentStep.getNextStep()

      expect(nextStep).toBeUndefined()
    })

    it('should skip reject branch and find distant MRF action step', async () => {
      await createMrfTriggerStep({ context, flowId: FLOW_ID })
      const mrfStep2 = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
      })
      await createRejectBranchStep({
        context,
        flowId: FLOW_ID,
        position: 3,
        linkedStepId: mrfStep2.id,
      })
      await createRejectBranchStep({
        context,
        flowId: FLOW_ID,
        position: 4,
        linkedStepId: mrfStep2.id,
      })
      await createRejectBranchStep({
        context,
        flowId: FLOW_ID,
        position: 5,
        linkedStepId: mrfStep2.id,
      })
      const mrfStep6 = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 6,
      })

      const currentStep = await fetchStep(mrfStep2.id)
      const nextStep = await currentStep.getNextStep()

      expect(nextStep).toBeDefined()
      expect(nextStep.id).toBe(mrfStep6.id)
    })
  })

  describe('complex multi-branch scenarios', () => {
    it('should handle consecutive MRF steps each with their own reject branches', async () => {
      await createMrfTriggerStep({ context, flowId: FLOW_ID })
      // MRF Step 2 + its reject branch
      const mrfStep2 = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
      })
      await createRejectBranchStep({
        context,
        flowId: FLOW_ID,
        position: 3,
        linkedStepId: mrfStep2.id,
      })
      // MRF Step 4 + its reject branch
      const mrfStep4 = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 4,
      })
      await createRejectBranchStep({
        context,
        flowId: FLOW_ID,
        position: 5,
        linkedStepId: mrfStep4.id,
      })
      // MRF Step 6
      const mrfStep6 = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 6,
      })

      // From mrfStep2, should skip its reject branch and land on mrfStep4
      const step2 = await fetchStep(mrfStep2.id)
      const nextFrom2 = await step2.getNextStep()
      expect(nextFrom2).toBeDefined()
      expect(nextFrom2.id).toBe(mrfStep4.id)

      // From mrfStep4, should skip its reject branch and land on mrfStep6
      const step4 = await fetchStep(mrfStep4.id)
      const nextFrom4 = await step4.getNextStep()
      expect(nextFrom4).toBeDefined()
      expect(nextFrom4.id).toBe(mrfStep6.id)
    })

    it('should not skip non-reject-branch normal steps', async () => {
      await createMrfTriggerStep({ context, flowId: FLOW_ID })
      const mrfStep2 = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
      })
      const normalStep3 = await createNormalActionStep({
        context,
        flowId: FLOW_ID,
        position: 3,
      })

      const currentStep = await fetchStep(mrfStep2.id)
      const nextStep = await currentStep.getNextStep()

      // Normal step at position 3 is not in a rejection branch → return it directly
      expect(nextStep).toBeDefined()
      expect(nextStep.id).toBe(normalStep3.id)
    })
  })
})
