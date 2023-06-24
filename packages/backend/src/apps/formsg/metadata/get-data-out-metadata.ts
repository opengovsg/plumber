import { IDataOutMetadata, IExecutionStep, IStep } from '@plumber/types'

import newSubmissionTrigger from '../triggers/new-submission'

async function getDataOutMetadata(
  stepKey: IStep['key'],
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  if (stepKey !== newSubmissionTrigger.key) {
    return null
  }

  const data = executionStep.dataOut
  if (!data) {
    return null
  }

  const fieldMetadata: IDataOutMetadata = Object.create(null)

  for (const [fieldId, fieldData] of Object.entries(data.fields)) {
    fieldMetadata[fieldId] = {
      question: { isVisible: false },
      fieldType: { isVisible: false },
      answer: {
        type: 'text',
        isVisible: true,
        label: `Answer (${fieldData.question})`,
      },
    }
  }

  return {
    fields: fieldMetadata,
    submissionId: { isVisible: false },
  }
}

export default getDataOutMetadata

// Reference dataOut for FormSG
// ---
// {
//   "fields": {
//     "647edbd2026dc800116b21f9": {
//       "answer": "zzz",
//       "question": "What is the air speed velocity of an unladen swallow?",
//       "fieldType": "textfield"
//     },
//     "648fe18a9175ce001196b3d5": {
//       "answer": "aaaa",
//       "question": "What is your name?",
//       "fieldType": "textfield"
//     }
//   },
//   "submissionId": "649306c1ac8851001149af0a"
// }
