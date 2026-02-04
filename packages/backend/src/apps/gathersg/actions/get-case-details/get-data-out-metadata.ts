import { IDataOutMetadata, IExecutionStep, IJSONArray } from '@plumber/types'

import { dataOutSchema } from './schema'

async function getDataOutMetadata(
  step: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut: rawDataOut } = step
  if (!rawDataOut) {
    return null
  }

  const parsedDataOut = dataOutSchema.safeParse(rawDataOut)
  if (!parsedDataOut.success) {
    return null
  }

  const { data: dataOut } = parsedDataOut.data

  const metadata = {
    data: {
      type: {
        name: { label: 'Case type' },
        uuid: { isHidden: true },
        slaDay: { isHidden: true },
      },
      uuid: { label: 'Case UUID' },
      caseRef: { label: 'Case ref' },
      source: { label: 'Case source' },
      status: {
        name: { label: 'Status' },
        uuid: { isHidden: true },
        color: { isHidden: true },
        isFinal: { isHidden: true },
      },
      createdAt: { label: 'Created at' },
      createdBy: {
        name: { label: 'Created by (name)' },
        email: { label: 'Created by (email)' },
        role: { isHidden: true },
        uuid: { isHidden: true },
      },
      updatedAt: { label: 'Updated at' },
      updatedBy: {
        name: { label: 'Updated by (name)' },
        email: { label: 'Updated by (email)' },
        role: { isHidden: true },
        uuid: { isHidden: true },
      },
      durationSec: { isHidden: true },
      durationPaused: { isHidden: true },
      email: {
        subject: { label: 'Email subject' },
        sender: {
          name: { label: 'Email sender (name)' },
          address: { label: 'Email sender (email)' },
        },
      },
    },
  }

  // handle tags if any
  // tags are an array of strings and exist at the top level alongside the
  // uuid, caseRef, etc
  const tagsMetadata = Object.create(null)
  if (dataOut.tags && Array.isArray(dataOut.tags)) {
    for (let i = 0; i < dataOut.tags.length; i++) {
      tagsMetadata[i] = { label: `Tag` }
    }
  }

  const attachmentsMetadata = Object.create(null)
  const attachmentKeys: string[] = []
  if (dataOut.attachments) {
    for (const key of Object.keys(dataOut.attachments)) {
      attachmentsMetadata[key] = {
        name: { isHidden: true },
        mimeType: { isHidden: true },
        size: { isHidden: true },
      }

      attachmentKeys.push(key)
    }
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
            // array of primitives (strings, numbers, etc.) - display as comma-separated values
            // allow to use as array

            // HACK: GatherSg returns the attachment field with an array of attachment ids
            // and a separate attachment object. we hide the array of attachment ids as it is
            // not useful to the user
            if (
              fieldValue.every(
                (item) =>
                  typeof item === 'string' && attachmentKeys.includes(item),
              )
            ) {
              fieldsMetadata[hexKey] = {
                label: decodedLabel,
                isHidden: true,
              }
            } else {
              fieldsMetadata[hexKey] = {
                label: decodedLabel,
                type: 'array',
                displayedValue: fieldValue.join(', '),
              }
            }
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
    data: {
      ...metadata.data,
      tags: tagsMetadata,
      fields: fieldsMetadata,
      attachments: attachmentsMetadata,
    },
  }
}

export default getDataOutMetadata
