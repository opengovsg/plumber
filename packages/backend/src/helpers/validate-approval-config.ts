import { IStep, IStepConfig } from '@plumber/types'

import get from 'lodash.get'

import { stepApprovalConfigSchema } from '@/apps/formsg/common/types'
import Step from '@/models/step'

import logger from './logger'

/**
 * TODO: write unit test for this function
 */
export async function validateApprovalConfig(
  config: IStepConfig,
  prevStep: IStep,
): Promise<
  | {
      isApprovalConfigValid: true
      newStepPosition: number
    }
  | {
      isApprovalConfigValid: false
    }
> {
  /**
   * Case 1: new step is a trigger step, return early
   */
  if (!prevStep) {
    return {
      isApprovalConfigValid: true,
      newStepPosition: 1,
    }
  }

  const isPreviousStepMrfApprovalStep =
    prevStep.appKey === 'formsg' &&
    prevStep.key === 'mrfSubmission' &&
    // if no approval field, it's just a normal mrf step
    !!get(prevStep.parameters, 'mrf.approvalField')

  /**
   * Case 2: Prev step has no approval config and is not an mrf approval step,
   * current step should have no approval config either
   */
  if (!prevStep.config.approval && !isPreviousStepMrfApprovalStep) {
    if (!config?.approval) {
      return {
        isApprovalConfigValid: true,
        newStepPosition: prevStep.position + 1,
      }
    }
    logger.error(
      'Invalid approval config: previous step has no approval config and is not an mrf approval step',
    )
    return {
      isApprovalConfigValid: false,
    }
  }

  /**
   * Case 3: Prev step is part of an approval branch, check that
   * the new step has the same approval config
   */
  if (prevStep.config.approval) {
    const isSameApprovalConfig =
      prevStep.config.approval?.branch === config?.approval?.branch &&
      prevStep.config.approval?.stepId === config?.approval?.stepId
    if (isSameApprovalConfig) {
      return {
        isApprovalConfigValid: true,
        newStepPosition: prevStep.position + 1,
      }
    }
    logger.error(
      'Invalid approval config: new step approval config is not the same as previous step',
    )
    return {
      isApprovalConfigValid: false,
    }
  }

  /**
   * Case 4: Previous step is an approval step
   */
  if (isPreviousStepMrfApprovalStep) {
    // validate approval config
    const { success } = stepApprovalConfigSchema.safeParse(config?.approval)
    // validate approval config step id is the same as prev step id
    if (!success || config.approval.stepId !== prevStep.id) {
      logger.error(
        'Invalid approval config (after approval step): invalid approval config or new step id is not the same as approval step id',
        {
          approvalConfig: config?.approval,
        },
      )
      return {
        isApprovalConfigValid: false,
      }
    }
    /**
     * If approval branch, simply add 1 to the prev step position
     */
    if (config.approval.branch === 'approve') {
      return {
        isApprovalConfigValid: true,
        newStepPosition: prevStep.position + 1,
      }
    }
    // If reject branch, find the end of the approval branch and add one to that step
    // first find the next mrf step (if any)
    const nextMrfStep = await Step.query()
      .where('flow_id', prevStep.flowId)
      .andWhere('type', 'action')
      .andWhere('key', 'mrfSubmission')
      .andWhere('position', '>', prevStep.position)
      .orderBy('position', 'asc')
      .first()
    // then find the last approval step in the curr branch (if any)
    const lastApprovalStepQuery = Step.query()
      .where('flow_id', prevStep.flowId)
      .andWhere('position', '>', prevStep.position)
      .andWhereRaw(`config->'approval'->>'branch' = ?`, ['approve'])
      .orderBy('position', 'desc')
      .first()

    if (nextMrfStep) {
      lastApprovalStepQuery.andWhere('position', '<', nextMrfStep.position)
    }
    const lastApprovalStep = await lastApprovalStepQuery.first()
    // If last approval step exists, return the position after that
    if (lastApprovalStep) {
      return {
        isApprovalConfigValid: true,
        newStepPosition: lastApprovalStep.position + 1,
      }
    } else {
      // If no last approval step, return the position after the previous step
      return {
        isApprovalConfigValid: true,
        newStepPosition: prevStep.position + 1,
      }
    }
  }

  /**
   * Catch all branch, something seems fishy
   */
  return {
    isApprovalConfigValid: false,
  }
}
