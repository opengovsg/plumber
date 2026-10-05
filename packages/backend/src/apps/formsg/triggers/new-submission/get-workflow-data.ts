import { IGlobalVariable } from '@/../../types'
import StepError from '@/errors/step'

import { getMrfStepName } from '../../common/get-mrf-step-name'
import {
  type FormSchema,
  mrfWorkflowDataSchema,
  type ParsedMrfWorkflow,
  type ParsedMrfWorkflowStep,
} from '../../common/types'

export function parseWorkflowData(
  $: IGlobalVariable,
  formSchema: FormSchema,
): ParsedMrfWorkflow | null {
  return parseMrfWorkflow(formSchema.form.workflow)
}

/**
 * Parses a form's raw workflow without needing a connection, so MRF steps
 * can be created before the trigger is ever tested.
 */
export function parseMrfWorkflow(workflow: unknown): ParsedMrfWorkflow {
  const result = mrfWorkflowDataSchema.safeParse(workflow)
  if (!result.success) {
    throw new StepError(
      'Invalid MRF data',
      'Reconnect your MRF form and try again.',
    )
  }

  const parsedSteps: ParsedMrfWorkflowStep[] = []
  const populatedFields: string[] = []

  for (const step of result.data) {
    populatedFields.push(...step.edit)
    parsedSteps.push({
      defaultStepName: getMrfStepName(step.step_name, parsedSteps.length),
      type: step.workflow_type,
      fields: [...populatedFields],
      formWorkflowStepId: step._id,
      approvalField: step.approval_field,
    })
  }

  return {
    trigger: parsedSteps[0],
    actions: parsedSteps.slice(1),
  }
}
