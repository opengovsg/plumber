import { type IDataOutMetadata, type IExecutionStep } from '@plumber/types'

export default async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const data = executionStep.dataOut
  if (!data || data.isConditionMet == null) {
    return null
  }

  return {
    isConditionMet: {
      label: 'Is Condition Met?',
      displayedValue: data.isConditionMet ? 'Yes' : 'No',
    },
  }
}

// Reference dataOut
// ---
// {
//   isConditionMet: true
// }
