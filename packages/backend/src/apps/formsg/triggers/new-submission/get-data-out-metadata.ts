import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const data = executionStep.dataOut
  if (!data) {
    return null
  }

  const fieldMetadata: IDataOutMetadata = Object.create(null)

  for (const [fieldId, fieldData] of Object.entries(data.fields)) {
    fieldMetadata[fieldId] = {
      question: {
        type: 'text',
        label: fieldData.order ? `Question ${fieldData.order}` : null,
        order: fieldData.order ? fieldData.order : null,
      },
      answer: {
        type: 'text',
        label: fieldData.order ? `Response ${fieldData.order}` : null,
        order: fieldData.order ? fieldData.order + 0.1 : null,
      },
      fieldType: { isHidden: true },
      order: { isHidden: true },
    }
  }

  return {
    fields: fieldMetadata,
    submissionId: {
      type: 'text',
      label: 'Submission ID',
    },
  }
}

export default getDataOutMetadata

// Reference dataOut
// ---
// {
//   "fields": {
//     "647edbd2026dc800116b21f9": {
//       "answer": "zzz",
//       "question": "What is the air speed velocity of an unladen swallow?",
//       "fieldType": "textfield"
//       "order": 2
//     },
//     "648fe18a9175ce001196b3d5": {
//       "answer": "aaaa",
//       "question": "What is your name?",
//       "fieldType": "textfield"
//       "order": 1
//     }
//   },
//   "submissionId": "649306c1ac8851001149af0a"
// }
