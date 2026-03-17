import { DateTime } from 'luxon'

import { FormsgPayloadWorkflowContent } from '../../common/types'

// Forms gives us submission time as ISO 8601 UTC TZ, but our users
// expect SGT time, so convert it to ISO 8601 SGT TZ (our Luxon is
// configured for SGT - so although fromISO -> toISO looks like a no-op,
// it internally does a TZ conversion).
function convertToSGT(submissionTime: string): string {
  return DateTime.fromISO(submissionTime).toISO()
}

interface FormsgPayload {
  created: string
  workflowContent?: FormsgPayloadWorkflowContent
}

/**
 * This funciton returns the submission time based on whether it's an MRF or SRF form.
 */
export function computeSubmissionTime(data: FormsgPayload): string {
  const workflowContent: FormsgPayloadWorkflowContent = data.workflowContent

  // If not MRF, just return submission creation time
  if (
    !workflowContent?.submittedSteps ||
    workflowContent.submittedSteps.length === 0
  ) {
    return convertToSGT(data.created)
  }
  // if MRF, return the last submitted step's submission time
  const lastSubmittedStep =
    workflowContent.submittedSteps[workflowContent.submittedSteps.length - 1]
  return convertToSGT(lastSubmittedStep.submittedAt)
}
