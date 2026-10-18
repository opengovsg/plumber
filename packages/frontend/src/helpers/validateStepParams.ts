import { IExecutionStep, IJSONObject, IStep, ISubstep } from '@plumber/types'

import { GLOBAL_VARIABLE_REGEX } from '@/components/RichTextEditor/utils'

const FORMSG_FIELD_PATH_PREFIX = 'fields.'

interface VariableReference {
  stepId: string
  path: string
}

function parseVariableReference(placeholder: string): VariableReference | null {
  // Table variables carry a `|<hex>` modifier that is not part of the path.
  const [reference] = placeholder.slice(2, -2).split('|')
  const [prefix, stepId, ...pathSegments] = reference.split('.')

  if (prefix !== 'step' || !stepId || pathSegments.length === 0) {
    return null
  }

  return { stepId, path: pathSegments.join('.') }
}

/**
 * Whether a `fields` key belongs to a question the form still has.
 *
 * MyInfo children answers are keyed by a composite ID that FormSG derives from
 * the parent question, e.g. `childrenbirthrecords_<parentFieldId>_childname_0`,
 * so only the parent appears in the form schema. Resolving the key back to its
 * parent keeps those answers valid while a deleted parent still flags.
 */
function isCurrentFormsgField(formFieldIds: string[], fieldKey: string) {
  return (
    formFieldIds.includes(fieldKey) ||
    fieldKey.split('_').some((segment) => formFieldIds.includes(segment))
  )
}

/**
 * Whether a reference points at a FormSG question that was deleted from the form.
 *
 * `formFieldIds` lists every question the form had when the step was last
 * tested, so an absent ID proves deletion. dataOut cannot prove it, because
 * submissions omit questions hidden by logic or left unanswered.
 */
function isDeletedFormsgField(
  executionStep: IExecutionStep,
  path: string,
): boolean {
  const formFieldIds = executionStep.metadata?.formFieldIds

  if (!formFieldIds || !path.startsWith(FORMSG_FIELD_PATH_PREFIX)) {
    return false
  }

  const [fieldKey] = path.slice(FORMSG_FIELD_PATH_PREFIX.length).split('.')

  if (!fieldKey) {
    return false
  }

  return !isCurrentFormsgField(formFieldIds, fieldKey)
}

export function hasMissingStepReference(
  obj: IJSONObject,
  priorExecutionSteps: Map<string, IExecutionStep>,
) {
  let hasMissing = false

  function traverse(value: any) {
    if (!value || hasMissing) {
      return
    }

    if (typeof value === 'string') {
      const regex = new RegExp(GLOBAL_VARIABLE_REGEX)
      let match

      while ((match = regex.exec(value)) !== null) {
        const reference = parseVariableReference(match[1])
        if (!reference) {
          continue
        }

        const executionStep = priorExecutionSteps.get(reference.stepId)
        if (
          !executionStep ||
          isDeletedFormsgField(executionStep, reference.path)
        ) {
          hasMissing = true
          return
        }
      }
    } else if (Array.isArray(value)) {
      value.forEach(traverse)
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(traverse)
    }
  }

  traverse(obj)
  return hasMissing
}

export const validateStepParams = (
  step: IStep,
  testExecutionSteps: IExecutionStep[],
  substeps: ISubstep[],
) => {
  const testResult = testExecutionSteps.find((ts) => ts.stepId === step.id)
  if (!testResult) {
    return {
      shouldTestStepAgain: false,
      isTestSuccessful: testResult,
    }
  }

  /**
   * FOR BACKWARD COMPATIBILITY
   * old UI allowed users to change events without changing the app
   * which resulted in additional parameters being stored in the step parameters.
   * we need to filter out these additional parameters to avoid validation errors.
   */
  const stepArgs = substeps.find((s) => s.key === 'setUpAction')?.arguments
  const stepParamKeys = stepArgs?.map((arg) => arg.key) || []
  const filteredParams = Object.fromEntries(
    Object.entries(step.parameters).filter(([key]) =>
      stepParamKeys.includes(key),
    ),
  )

  const shouldTestStepAgain = hasMissingStepReference(
    filteredParams,
    new Map(
      testExecutionSteps
        .filter((ts) => ts.step.position < step.position)
        .map((ts) => [ts.stepId, ts]),
    ),
  )

  return {
    shouldTestStepAgain,
    isTestSuccessful: testResult.status === 'success',
  }
}
