import { IStep } from '@plumber/types'

import get from 'lodash.get'

/**
 * A step is an MRF approval step only if FormSG's approval_field was set for
 * it — an MRF step with no approval_field is just a normal sequential step.
 */
export function isMrfApprovalStep(
  step: Pick<IStep, 'appKey' | 'key' | 'parameters'>,
): boolean {
  return (
    step.appKey === 'formsg' &&
    step.key === 'mrfSubmission' &&
    !!get(step.parameters, 'mrf.approvalField')
  )
}
