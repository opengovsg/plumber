import { IDataOutMetadata, IExecutionStep, IStep } from '@plumber/types'

import { parsePlumberS3Id } from '@/helpers/plumber-s3'

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
    if (fieldData.fieldType === 'attachment') {
      fieldMetadata[fieldId] = {
        question: { isVisible: false },
        fieldType: { isVisible: false },
        answer: {
          type: 'file',
          isVisible: true,
          label: `File for "${fieldData.question}"`,
          displayedValue:
            // Currently, we _know_ that the value has to be a Plumber S3 ID.
            parsePlumberS3Id(fieldData.answer)?.objectName ?? fieldData.answer,
        },
      }
    }
  }

  return {
    fields: fieldMetadata,
  }
}

export default getDataOutMetadata

// Reference dataOut for FormSG
// ---
// {
//   {
//     "647edbd2026dc800116b21f9": {
//       question: "What is the air speed velocity of an unladen swallow?",
//       answer: "topkek",
//       fieldType: "textfield",
//     },
//     "648fe18a9175ce001196b3d5": {
//       question: "What is your name? (Optional)",
//       answer: "",
//       fieldType: "textfield",
//     },
//     "649d3183c4c52f00124ceb16": {
//       question: "Attach your sparrow velocity readings.",
//       answer: "plumber-s3://s3.ap-southeast-1.amazonaws.com/abcd-123-wxyz/readings.txt"
//       fieldType: "attachment",
//     },
//   }
// }
