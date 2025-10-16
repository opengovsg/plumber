import type { IGlobalVariable, IRawAction } from '@plumber/types'

import StepError from '@/errors/step'
import ExecutionStep from '@/models/execution-step'
import Step from '@/models/step'

import getDataOutMetadata from '../../common/get-data-out-metadata'
import {
  type ParsedMrfWorkflowStep,
  parsedMrfWorkflowStepSchema,
} from '../../common/types'

const action: IRawAction = {
  name: 'New form response',
  key: 'mrfSubmission',
  hiddenFromUser: true,
  description:
    'This is a hidden action that signifies a subsequent MRF submission',
  getDataOutMetadata,

  async testRun($: IGlobalVariable) {
    // Gets the execution step of the trigger
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

    const triggerStep = await Step.query()
      .findOne({
        flow_id: $.flow.id,
        type: 'trigger',
        key: 'newSubmission',
        app_key: 'formsg',
      })
      .throwIfNotFound()
    const triggerExecutionStep = await ExecutionStep.query()
      .where('step_id', triggerStep.id)
      .andWhere('execution_id', $.execution.id)
      .first()

    if (!triggerExecutionStep) {
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
