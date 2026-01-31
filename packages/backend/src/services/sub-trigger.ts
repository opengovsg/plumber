import type { ITriggerItem, SubtriggerData } from '@plumber/types'

import get from 'lodash.get'

import logger from '@/helpers/logger'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Step from '@/models/step'

export type ProcessSubTriggerOptions = {
  flowId: string
  triggerItem: ITriggerItem
  subtriggerData: SubtriggerData
}

type ProcessSubTriggerResult = {
  executionId: string
  executionStep: ExecutionStep
  /**
   * The next step to execute after the MRF action step
   */
  nextStep: Step | null
  shouldExecute: boolean
}

/**
 * Processes a sub-trigger for MRF (multi-respondent form) subsequent submissions.
 * Instead of creating a new execution, it finds the existing execution by submissionId
 * and creates an execution step for the corresponding MRF action step.
 */
export const processSubTrigger = async (
  options: ProcessSubTriggerOptions,
): Promise<ProcessSubTriggerResult | null> => {
  const { flowId, triggerItem, subtriggerData } = options
  const internalId = triggerItem.meta.internalId

  if (subtriggerData.type !== 'mrf') {
    logger.error(
      `Sub-trigger: Subtrigger data type is not MRF for internalId: ${internalId}, flowId: ${flowId}`,
      {
        event: 'sub-trigger-subtrigger-data-type-not-mrf',
        flowId,
        internalId,
      },
    )
    return null
  }

  if (!internalId) {
    logger.error(`Sub-trigger: No internalId found for flowId: ${flowId}`, {
      event: 'sub-trigger-no-internal-id',
      flowId,
    })
  }
  // Find the execution to attach to
  const execution = await Execution.query()
    .where({
      flow_id: flowId,
      test_run: false,
      internal_id: internalId,
    })
    .first()

  if (!execution) {
    // No existing execution found - skip processing per requirements
    logger.warn(
      `Sub-trigger: No existing execution found for internalId: ${internalId}, flowId: ${flowId}`,
      {
        event: 'sub-trigger-no-execution',
        flowId,
        internalId,
        mrfStepId: subtriggerData.mrfStepId,
      },
    )
    return null
  }

  // Find all MRF action steps for this flow, ordered by position
  const mrfSteps = await Step.query()
    .where({
      flow_id: flowId,
      type: 'action',
      app_key: 'formsg',
      key: 'mrfSubmission',
    })
    .orderBy('position', 'asc')

  // workflowStep is 1-indexed from FormSG, so the Nth MRF step corresponds to workflowStep N
  // (workflowStep 1 = first MRF action step, workflowStep 2 = second MRF action step, etc.)
  const mrfStep = mrfSteps.find(
    (step) =>
      get(step.parameters, 'mrf.formWorkflowStepId', null) ===
      subtriggerData.mrfStepId,
  )

  if (!mrfStep) {
    logger.error(
      `Sub-trigger: MRF step not found for workflowStep: ${subtriggerData.mrfStepId}, flowId: ${flowId}`,
      {
        event: 'sub-trigger-mrf-step-not-found',
        flowId,
        internalId,
        mrfStepId: subtriggerData.mrfStepId,
      },
    )
    return null
  }

  // Create the execution step for the MRF action step
  const executionStep = await execution
    .$relatedQuery('executionSteps')
    .insertAndFetch({
      stepId: mrfStep.id,
      dataIn: mrfStep.parameters,
      dataOut: triggerItem.raw,
      appKey: mrfStep.appKey,
      key: mrfStep.key,
    })

  return {
    executionId: execution.id,
    executionStep,
    nextStep: mrfStep ?? null,
    shouldExecute: true,
  }
}
