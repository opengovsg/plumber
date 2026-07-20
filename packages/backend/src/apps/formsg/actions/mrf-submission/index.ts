import type { IGlobalVariable, IRawAction } from '@plumber/types'

import {
  didConditionalStepSkip,
  getParentConditionalSteps,
} from '@/apps/toolbox/common/block-execution'
import StepError from '@/errors/step'
import logger from '@/helpers/logger'
import ExecutionStep from '@/models/execution-step'
import Step from '@/models/step'

import getDataOutMetadata from '../../common/get-data-out-metadata'
import {
  FormsgPayloadWorkflowContent,
  type ParsedMrfWorkflowStep,
  parsedMrfWorkflowStepSchema,
  submittedStepsSchema,
} from '../../common/types'

import { findPreviousExecutableStep } from './previous-executable-step'

/**
 * A retried step can have several execution-step rows; only the latest one counts.
 */
async function getLatestExecutionStepsByStepId(
  executionId: string,
  stepIds: string[],
): Promise<Map<string, ExecutionStep>> {
  const executionSteps = await ExecutionStep.query()
    .where('execution_id', executionId)
    .whereIn('step_id', stepIds)
    .orderBy('created_at', 'desc')

  const latestByStepId = new Map<string, ExecutionStep>()
  for (const executionStep of executionSteps) {
    if (!latestByStepId.has(executionStep.stepId)) {
      latestByStepId.set(executionStep.stepId, executionStep)
    }
  }
  return latestByStepId
}

/**
 * Checks whether the current execution has executed steps up until this
 * sub-trigger.
 *
 * This is to handle MRF submissions arriving too early (i.e. before steps in
 * before this sub-trigger could finish running).
 */
async function hasExecutionReachedMe(
  executionId: string,
  flowSteps: Step[],
  previousExecutableStep: Step,
): Promise<boolean> {
  const parentConditionalSteps = getParentConditionalSteps(
    flowSteps,
    previousExecutableStep,
  )
  const latestExecutionSteps = await getLatestExecutionStepsByStepId(
    executionId,
    [
      previousExecutableStep.id,
      ...parentConditionalSteps.map((step) => step.id),
    ],
  )

  const previousExecutableExecutionStep = latestExecutionSteps.get(
    previousExecutableStep.id,
  )
  // Defense in depth: never proceed past an immediately preceding failed step.
  if (previousExecutableExecutionStep?.isFailed) {
    return false
  }
  if (previousExecutableExecutionStep) {
    return true
  }

  return parentConditionalSteps.some((step) =>
    didConditionalStepSkip(step, latestExecutionSteps.get(step.id)),
  )
}

function validateMrfStep($: IGlobalVariable): ParsedMrfWorkflowStep {
  const { mrf } = $.step.parameters as unknown as {
    mrf: ParsedMrfWorkflowStep
  }
  if (!mrf || parsedMrfWorkflowStepSchema.safeParse(mrf).success === false) {
    throw new StepError(
      'Misconfigured MRF step',
      'Reconnect your MRF form and try again.',
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

  async run($: IGlobalVariable) {
    validateMrfStep($)
    /*
     * Find the previous executable trigger/action step in the workflow
     * that should be already executed in order for this current step to proceed
     */
    const flowSteps = await Step.query()
      .where('flow_id', $.flow.id)
      .orderBy('position', 'asc')
    const previousExecutableStep = findPreviousExecutableStep(
      flowSteps,
      $.step.position,
    )
    if (!previousExecutableStep) {
      throw new StepError(
        'Previous executable step not found',
        'The previous executable step was not found. This should not happen.',
      )
    }

    if (
      !(await hasExecutionReachedMe(
        $.execution.id,
        flowSteps,
        previousExecutableStep,
      ))
    ) {
      // end and do nothing
      logger.info({
        event:
          'mrf-submission - previous executable execution step not found or failed',
        executionId: $.execution.id,
        previousExecutableStepId: previousExecutableStep.id,
      })
      return {
        nextStep: {
          command: 'pause-execution',
        },
      }
    }

    const currentExecutionStep = await $.getLastExecutionStep({
      sameExecution: true,
    })

    if (!currentExecutionStep) {
      logger.info({
        event: 'mrf-submission - no webhook yet',
        executionId: $.execution.id,
      })
      return {
        nextStep: {
          command: 'pause-execution',
        },
      }
    }

    // Extract the workflowContent (current workflow state and metadata) and fields (form responses) from the last execution step's output.
    const { workflowContent } = currentExecutionStep.dataOut as unknown as {
      workflowContent: FormsgPayloadWorkflowContent
    }

    const submittedStepsResult = submittedStepsSchema.safeParse(
      workflowContent.submittedSteps,
    )
    // Ensure workflowContent exists and workflowStep index is a valid number.
    if (submittedStepsResult.success === false) {
      // If these are missing, something has gone wrong in the form submission or wiring.
      throw new StepError(
        'Invalid MRF data: submitted steps are not valid',
        'Click check step to sync your MRF form and try again.',
      )
    }

    // Find the last submitted step which is the current step
    const submittedStep =
      submittedStepsResult.data[submittedStepsResult.data.length - 1]
    if (!submittedStep) {
      // Should never happen unless the workflow schema did not sync or was changed.
      throw new StepError(
        'Invalid MRF data: unable to find submitted step',
        'Click check step to sync your MRF form and try again.',
      )
    }

    // If this workflow step does not require approval (no approval_field), we can immediately enqueue the next step.
    if (!submittedStep.isApproval) {
      // No approval field means no gating required -- move forward.
      return
    }

    const isApproved = submittedStep.status === 'APPROVED'

    // Check the value of the approval field and handle the response accordingly.
    if (isApproved) {
      // If approved ("Yes"), continue with normal workflow and enqueue the next step.
      logger.info({
        event: 'mrf-submission - approved',
        executionId: $.execution.id,
      })
      return
    }
    // If rejected ("No"), skip to the rejection branch. (Logic to skip is elsewhere.)
    // Find the next step in the rejection branch based on current step id
    const nextStep = await Step.query()
      .where('flow_id', $.flow.id)
      .andWhere('position', '>', $.step.position)
      .orderBy('position', 'asc')
      .andWhereRaw(`steps.config->'approval'->>'branch' = ?`, ['reject'])
      .andWhereRaw(`steps.config->'approval'->>'stepId' = ?`, [$.step.id])
      .first()

    logger.info({
      event: 'mrf-submission - rejection branch',
      executionId: $.execution.id,
      nextStepId: nextStep?.id,
    })
    if (!nextStep) {
      return {
        nextStep: {
          command: 'stop-execution',
        },
      }
    }
    return {
      nextStep: {
        command: 'jump-to-step',
        stepId: nextStep.id,
      },
    }
  },
}

export default action
