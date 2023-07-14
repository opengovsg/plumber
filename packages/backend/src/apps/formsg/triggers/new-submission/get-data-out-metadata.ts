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

  const verifiedMetadata: IDataOutMetadata = Object.create(null)
  if (data.verifiedSubmitterInfo) {
    for (const key of Object.keys(data.verifiedSubmitterInfo)) {
      switch (key) {
        case 'uinFin':
          verifiedMetadata.uinFin = { label: 'NRIC/FIN (Verified)' }
          break
        case 'sgidUinFin':
          verifiedMetadata.sgidUinFin = { label: 'NRIC/FIN (Verified)' }
          break
        case 'cpUid':
          verifiedMetadata.cpUid = { label: 'CorpPass UID (Verified)' }
          break
        case 'cpUen':
          verifiedMetadata.cpUen = { label: 'CorpPass UEN (Verified)' }
          break
      }
    }
  }

  return {
    fields: fieldMetadata,
    ...(data.verifiedSubmitterInfo && {
      verifiedSubmitterInfo: verifiedMetadata,
    }),
    submissionId: {
      type: 'text',
      label: 'Submission ID',
    },
    submissionTime: {
      type: 'text',
      label: 'Submission Time',
    },
  }
}

export default getDataOutMetadata

// Reference dataOut
// ---
// {
//   fields: {
//     647edbd2026dc800116b21f9: {
//       answer: 'zzz',
//       question: 'What is the air speed velocity of an unladen swallow?',
//       fieldType: 'textfield'
//       order: 2
//     },
//     648fe18a9175ce001196b3d5: {
//       answer: 'aaaa',
//       question: 'What is your name?',
//       fieldType: 'textfield'
//       order: 1
//     }
//   },
//   # verifiedSubmitterInfo may not exist!
//   verifiedSubmitterInfo: {
//       uinFin: 'S1234567B',
//       sgidUinFin: 'S1234567A',
//       cpUid: 'U987654323PLUMBER',
//       cpUen: 'S7654321Z',
//     },
//   submissionId: '649306c1ac8851001149af0a'
//   submissionTime: '2023-07-06T18:26:27.505+08:00'
// }
