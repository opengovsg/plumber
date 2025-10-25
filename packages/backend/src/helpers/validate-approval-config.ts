import { IStep, IStepConfig } from '@plumber/types'

import get from 'lodash.get'

export function validateApprovalConfig(config: IStepConfig, prevStep: IStep) {
  /**
   * if approval config is not present, or is a trigger, return true
   */
  if (!config?.approval || !prevStep) {
    return true
  }

  /**
   * Both approval branch and approval step id must come together
   */
  if (!(config?.approval?.branch && config?.approval?.stepId)) {
    return false
  }

  /**
   * If previous step an approval step return true
   */
  if (
    prevStep.id === config.approval?.stepId &&
    prevStep.appKey === 'formsg' &&
    prevStep.key === 'mrfSubmission' &&
    !!get(prevStep.parameters, 'mrf.approvalField')
  ) {
    return true
  }

  /**
   * If previous step has the same approval branch and step id, return true
   */
  if (
    prevStep.config.approval?.branch === config.approval?.branch &&
    prevStep.config.approval?.stepId === config.approval?.stepId
  ) {
    return true
  }

  return false
}
