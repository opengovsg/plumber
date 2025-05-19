import { IExecutionStep, IJSONObject, IStep } from '@plumber/types'

import { GLOBAL_VARIABLE_REGEX } from '@/components/RichTextEditor/utils'

function hasMissingStepReference(obj: IJSONObject, stepMap: Set<string>) {
  const missing = new Set()

  function traverse(value: any) {
    if (!value) {
      return
    }

    if (typeof value === 'string') {
      const regex = new RegExp(GLOBAL_VARIABLE_REGEX)
      let match

      while ((match = regex.exec(value)) !== null) {
        try {
          const stepId = match[1].split('.')[1]
          if (!stepMap.has(stepId)) {
            missing.add(stepId)
          }
        } catch (error) {
          continue
        }
      }
    } else if (Array.isArray(value)) {
      value.forEach(traverse)
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(traverse)
    }
  }

  traverse(obj)
  return missing.size > 0
}

export const validateStepParams = (
  step: IStep,
  testExecutionSteps: IExecutionStep[],
) => {
  const testResult = testExecutionSteps.find((ts) => ts.stepId === step.id)
  if (!testResult) {
    return {
      shouldTestStepAgain: false,
      isTestSuccessful: testResult,
    }
  }
  const shouldTestStepAgain = hasMissingStepReference(
    step.parameters,
    new Set(testExecutionSteps.map((ts) => ts.stepId)),
  )

  return {
    shouldTestStepAgain,
    isTestSuccessful: testResult.status === 'success',
  }
}
