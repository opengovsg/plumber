import type { IGlobalVariable, IRawAction } from '@plumber/types'

import StepError from '@/errors/step'
import ExecutionStep from '@/models/execution-step'
import Step from '@/models/step'

import getDataOutMetadata from '../../common/get-data-out-metadata'
import {
  FormsgPayloadWorkflowContent,
  type ParsedMrfWorkflowStep,
  parsedMrfWorkflowStepSchema,
} from '../../common/types'

function validateMrfStep($: IGlobalVariable): ParsedMrfWorkflowStep {
  const { mrf } = $.step.parameters as unknown as {
    mrf: ParsedMrfWorkflowStep
  }
  if (!mrf || parsedMrfWorkflowStepSchema.safeParse(mrf).success === false) {
    throw new StepError(
      'Misconfigured MRF step',
      'Reconnect your MRF form and try again.',
      $.step.position,
      $.app.name,
    )
  }
  return mrf
}

const action: IRawAction = {
  name: 'New form response',
  key: 'mrfSubmission',
  hiddenFromUser: true,
  description:
    'This is a hidden action that signifies a subsequent MRF submission',
  getDataOutMetadata,

  async testRun($: IGlobalVariable) {
    // Gets the execution step of the trigger
    const mrf = validateMrfStep($)

    const triggerStep = await Step.query()
      .findOne({
        flow_id: $.flow.id,
        type: 'trigger',
        key: 'newSubmission',
        app_key: 'formsg',
      })
      .throwIfNotFound()
    const triggerExecutionStep = await ExecutionStep.query().findOne({
      step_id: triggerStep.id,
      execution_id: $.execution.id,
    })

    if (!triggerExecutionStep) {
      $.setActionItem({
        raw: null,
      })
      return
    }

    const workflowContent = triggerExecutionStep.dataOut
      .workflowContent as unknown as FormsgPayloadWorkflowContent

    /**
     * Dont bother checking fields if it's a mock submission
     */
    if (triggerExecutionStep.metadata?.isMock) {
      $.setActionItem({
        raw: triggerExecutionStep.dataOut,
        meta: triggerExecutionStep.metadata, // this contains isMock and lastTestSubmissionDate
      })
      return
    }

    /**
     * If it's not a mock submission, and the workflow content is not available, show no test data
     * It means it's not a valid mrf submission
     */
    if (!workflowContent) {
      $.setActionItem({
        raw: null,
      })
      return
    }

    /**
     * The current trigger data could have not completed this step of the MRF yet.
     * If the submitted steps do not include the current MRF step, show no test data
     */
    const completedWorkflowSteps = workflowContent.workflow.slice(
      0,
      workflowContent.workflowStep + 1,
    )

    if (
      !completedWorkflowSteps ||
      !completedWorkflowSteps
        .map((step) => step._id)
        .includes(mrf.formWorkflowStepId)
    ) {
      $.setActionItem({
        raw: null,
      })
      return
    }

    $.setActionItem({
      raw: triggerExecutionStep.dataOut,
      meta: triggerExecutionStep.metadata,
    })
  },
}

export default action
