import { IDataOutMetadata, IExecutionStep, IJSONArray } from '@plumber/types'

import { dataOutSchema } from './schema'

async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut: rawDataOut } = executionStep

  if (!rawDataOut) {
    return null
  }

  const parsedDataOut = dataOutSchema.safeParse(rawDataOut)
  if (parsedDataOut.success === false) {
    return null
  }

  const { data: dataOut } = parsedDataOut.data

  const caseMetadata: IDataOutMetadata = {
    app: { label: 'App' },
    signature: { isHidden: true },
    timestamp: { label: 'Timestamp' },
  }

  // handle formsg field
  let formSgMetadata = Object.create(null)
  if (dataOut.formsg) {
    formSgMetadata.formId = { label: 'FormSG (form ID)' }
    formSgMetadata.submissionId = { label: 'FormSG (submission ID)' }
  } else {
    formSgMetadata = { isHidden: true }
  }

  // handle createdBy field
  let createdByMetadata = Object.create(null)
  if (dataOut.createdBy) {
    createdByMetadata.email = { label: 'Created by (email)' }
    createdByMetadata.name = { label: 'Created by (name)' }
  } else {
    createdByMetadata = { isHidden: true }
  }

  // handle updatedBy field
  let updatedByMetadata = Object.create(null)
  if (dataOut.updatedBy) {
    updatedByMetadata.email = { label: 'Updated by (email)' }
    updatedByMetadata.name = { label: 'Updated by (name)' }
  } else {
    updatedByMetadata = { isHidden: true }
  }

  // handle hex-encoded field names from dataOut
  const fieldsMetadata = Object.create(null)
  if (dataOut.fields) {
    for (const hexKey of Object.keys(dataOut.fields)) {
      try {
        // decode hex key to get the original column name
        const decodedLabel = Buffer.from(hexKey, 'hex').toString('utf-8')
        const fieldValue = dataOut.fields[hexKey]

        // check if the value is an array
        if (Array.isArray(fieldValue)) {
          // check if it's an array of objects or an array of primitives
          if (
            fieldValue.length > 0 &&
            typeof fieldValue[0] === 'object' &&
            fieldValue[0] !== null
          ) {
            // array of objects - create nested object structure for each row
            const array = fieldValue as IJSONArray
            const rowsMetadata = Object.create(null)

            for (let i = 0; i < array.length; i++) {
              const rowObject = array[i]
              const rowMetadata = Object.create(null)

              if (typeof rowObject === 'object' && rowObject !== null) {
                for (const nestedKey of Object.keys(rowObject)) {
                  rowMetadata[nestedKey] = {
                    type: 'text',
                    label: `${decodedLabel} Row ${i + 1} ${nestedKey}`,
                  }
                }
              }

              rowsMetadata[i] = rowMetadata
            }

            fieldsMetadata[hexKey] = rowsMetadata
          } else {
            // array of primitives (strings, numbers, etc.) - treat as simple field
            fieldsMetadata[hexKey] = { label: decodedLabel }
          }
        } else {
          // not an array - treat as simple field
          fieldsMetadata[hexKey] = { label: decodedLabel }
        }
      } catch (error) {
        // if decoding fails, use the hex key as-is
        fieldsMetadata[hexKey] = { label: hexKey }
      }
    }
  }

  return {
    ...caseMetadata,
    data: {
      fields: fieldsMetadata,
      formsg: formSgMetadata,
      createdBy: createdByMetadata,
      updatedBy: updatedByMetadata,
    },
  }
}

export default getDataOutMetadata
