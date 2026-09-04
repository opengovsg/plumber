import { IStepConfig } from '@plumber/types'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  createMrfActionStep,
  createMrfTriggerStep,
  createNormalActionStep,
  createRejectBranchStep,
  generateMockContext,
  generateMockFlow,
} from '@/apps/formsg/__tests__/mrf.mock'
import type Context from '@/types/express/context'

import { validateApprovalConfig } from '../validate-approval-config'

const FLOW_ID = '00000000-0000-0000-0000-000000000001'

describe('validateApprovalConfig - reject branch positioning', () => {
  let context: Context

  beforeEach(async () => {
    context = await generateMockContext()
    await generateMockFlow(context, FLOW_ID)
  })

  function makeRejectConfig(stepId: string): IStepConfig {
    return {
      approval: { branch: 'reject', stepId },
    } as IStepConfig
  }

  describe('approve branch has steps, reject branch has none', () => {
    it('should position after the last approve branch step', async () => {
      // Flow: trigger(1) -> mrfApproval(2) -> approve(3) -> approve(4)
      await createMrfTriggerStep({ context, flowId: FLOW_ID })
      const mrfStep = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
        approvalField: 'approval_field',
      })
      await createNormalActionStep({ context, flowId: FLOW_ID, position: 3 })
      await createNormalActionStep({ context, flowId: FLOW_ID, position: 4 })

      const result = await validateApprovalConfig(
        makeRejectConfig(mrfStep.id),
        mrfStep,
      )

      expect(result).toEqual({
        isApprovalConfigValid: true,
        newStepPosition: 5,
      })
    })

    it('should position after the last approve step bounded by next MRF step', async () => {
      // Flow: trigger(1) -> mrfApproval(2) -> approve(3) -> approve(4) -> mrfAction(5)
      await createMrfTriggerStep({ context, flowId: FLOW_ID })
      const mrfStep = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
        approvalField: 'approval_field',
      })
      await createNormalActionStep({ context, flowId: FLOW_ID, position: 3 })
      await createNormalActionStep({ context, flowId: FLOW_ID, position: 4 })
      await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 5,
      })

      const result = await validateApprovalConfig(
        makeRejectConfig(mrfStep.id),
        mrfStep,
      )

      expect(result).toEqual({
        isApprovalConfigValid: true,
        newStepPosition: 5,
      })
    })
  })

  describe('approve branch has no steps, reject branch also has none', () => {
    it('should position right after the MRF approval step', async () => {
      // Flow: trigger(1) -> mrfApproval(2)
      await createMrfTriggerStep({ context, flowId: FLOW_ID })
      const mrfStep = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
        approvalField: 'approval_field',
      })

      const result = await validateApprovalConfig(
        makeRejectConfig(mrfStep.id),
        mrfStep,
      )

      expect(result).toEqual({
        isApprovalConfigValid: true,
        newStepPosition: 3,
      })
    })

    it('should position right after MRF step when next MRF step exists but nothing in between', async () => {
      // Flow: trigger(1) -> mrfApproval(2) -> mrfAction(3)
      await createMrfTriggerStep({ context, flowId: FLOW_ID })
      const mrfStep = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
        approvalField: 'approval_field',
      })
      await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 3,
      })

      const result = await validateApprovalConfig(
        makeRejectConfig(mrfStep.id),
        mrfStep,
      )

      expect(result).toEqual({
        isApprovalConfigValid: true,
        newStepPosition: 3,
      })
    })
  })

  describe('approve branch has steps, reject branch has existing steps', () => {
    it('should position right after the mrf step in the region (1st reject step)', async () => {
      // Flow: trigger(1) -> mrfApproval(2) -> approve(3) -> approve(4) -> reject(5) -> reject(6)
      await createMrfTriggerStep({ context, flowId: FLOW_ID })
      const mrfStep = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
        approvalField: 'approval_field',
      })
      await createNormalActionStep({ context, flowId: FLOW_ID, position: 3 })
      await createNormalActionStep({ context, flowId: FLOW_ID, position: 4 })
      await createRejectBranchStep({
        context,
        flowId: FLOW_ID,
        position: 5,
        linkedStepId: mrfStep.id,
      })
      await createRejectBranchStep({
        context,
        flowId: FLOW_ID,
        position: 6,
        linkedStepId: mrfStep.id,
      })

      const result = await validateApprovalConfig(
        makeRejectConfig(mrfStep.id),
        mrfStep,
      )

      expect(result).toEqual({
        isApprovalConfigValid: true,
        newStepPosition: 5,
      })
    })
  })

  describe('approve branch has no steps, reject branch has existing steps', () => {
    it('should position as the first reject step', async () => {
      // Flow: trigger(1) -> mrfApproval(2) -> reject(3) -> reject(4)
      await createMrfTriggerStep({ context, flowId: FLOW_ID })
      const mrfStep = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
        approvalField: 'approval_field',
      })
      await createRejectBranchStep({
        context,
        flowId: FLOW_ID,
        position: 3,
        linkedStepId: mrfStep.id,
      })
      await createRejectBranchStep({
        context,
        flowId: FLOW_ID,
        position: 4,
        linkedStepId: mrfStep.id,
      })

      const result = await validateApprovalConfig(
        makeRejectConfig(mrfStep.id),
        mrfStep,
      )

      expect(result).toEqual({
        isApprovalConfigValid: true,
        newStepPosition: 3,
      })
    })

    it('should be bounded by next MRF step when reject steps exist', async () => {
      // Flow: trigger(1) -> mrfApproval(2) -> reject(3) -> mrfAction(4)
      await createMrfTriggerStep({ context, flowId: FLOW_ID })
      const mrfStep = await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 2,
        approvalField: 'approval_field',
      })
      await createRejectBranchStep({
        context,
        flowId: FLOW_ID,
        position: 3,
        linkedStepId: mrfStep.id,
      })
      await createMrfActionStep({
        context,
        flowId: FLOW_ID,
        position: 4,
      })

      const result = await validateApprovalConfig(
        makeRejectConfig(mrfStep.id),
        mrfStep,
      )

      expect(result).toEqual({
        isApprovalConfigValid: true,
        newStepPosition: 3,
      })
    })
  })
})
