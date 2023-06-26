import { IExecutionStep, IStep, TFrontEndVariable } from '@plumber/types'

import getFrontEndSubstitutionKey from '@/helpers/get-front-end-substitution-key'

import newSubmissionTrigger from '../triggers/new-submission'

async function getFrontEndVariables(
  stepKey: IStep['key'],
  executionSteps: Array<IExecutionStep>,
): Promise<Array<TFrontEndVariable>> {
  if (stepKey !== newSubmissionTrigger.key) {
    return null
  }

  // We should only ever have 1 execution step
  const dataOut = executionSteps[0].dataOut
  if (!dataOut) {
    return null
  }

  const variables: Array<TFrontEndVariable> = []
  for (const [index, [fieldId, fieldData]] of Object.entries(
    dataOut.fields,
  ).entries()) {
    variables.push({
      name: `Question ${index + 1}`,
      type: 'text',
      value: fieldData.question,
      substitutionKey: getFrontEndSubstitutionKey(
        executionSteps[0],
        `fields.${fieldId}.question`,
      ),
    })
    variables.push({
      name: `Answer ${index + 1}`,
      type: 'text',
      value: fieldData.answer,
      substitutionKey: getFrontEndSubstitutionKey(
        executionSteps[0],
        `fields.${fieldId}.answer`,
      ),
    })
  }

  return variables
}

export default getFrontEndVariables
