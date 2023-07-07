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
      question: {
        type: 'text',
        isVisible: true,
        label: `Question ${fieldData.questionNumber}`,
        renderPosition: fieldData.questionNumber,
      },
      answer: {
        type: 'text',
        isVisible: true,
        label: `Response ${fieldData.questionNumber}`,
        renderPosition: fieldData.questionNumber + 0.1,
      },
      fieldType: { isVisible: false },
      questionNumber: { isVisible: false },
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
//       "questionNumber": 2
//     },
//     "648fe18a9175ce001196b3d5": {
//       "answer": "aaaa",
//       "question": "What is your name?",
//       "fieldType": "textfield"
//       "questionNumber": 1
//     }
//   },
//   "submissionId": "649306c1ac8851001149af0a"
// }
