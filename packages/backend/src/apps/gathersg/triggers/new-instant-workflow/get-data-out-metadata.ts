import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

import {
  createAttachmentsMetadata,
  createFieldMetadata,
  createFormSgMetadata,
  createTagMetadata,
  createUserMetadata,
} from '../../common/data-out-metadata-helpers'

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

  // handle optional nested objects
  const formSgMetadata = createFormSgMetadata(dataOut?.formsg)
  const createdByMetadata = createUserMetadata(dataOut?.createdBy, 'Created by')
  const updatedByMetadata = createUserMetadata(dataOut?.updatedBy, 'Updated by')
  const finalisedByMetadata = createUserMetadata(
    dataOut?.finalisedBy,
    'Finalised by',
  )

  const { attachmentsMetadata, attachmentKeys } =
    createAttachmentsMetadata(dataOut)

  // handle hex-encoded field names from dataOut
  const fieldsMetadata: Record<string, any> = {}
  if (dataOut?.fields) {
    for (const key of Object.keys(dataOut.fields)) {
      try {
        const fieldValue = dataOut.fields[key]
        fieldsMetadata[key] = createFieldMetadata(
          key,
          fieldValue,
          attachmentKeys,
        )
      } catch {
        // if decoding fails, use the hex key as-is
        fieldsMetadata[key] = { label: key }
      }
    }
  }

  const tagsMetadata = createTagMetadata(dataOut)

  return {
    ...caseMetadata,
    data: {
      fields: fieldsMetadata,
      formsg: formSgMetadata,
      createdBy: createdByMetadata,
      finalisedBy: finalisedByMetadata,
      updatedBy: updatedByMetadata,
      attachments: attachmentsMetadata,
      tags: tagsMetadata,

      caseRef: { label: 'Case ref' },
      createdAt: { label: 'Created at' },
      email: { isHidden: true }, // hide to avoid confusing user in case there is an email field
      finalisedAt: { label: 'Finalised at' },
      source: { label: 'Source' },
      status: { label: 'Status' },
      type: { label: 'Case type' },
      updatedAt: { label: 'Updated at' },
      uuid: { label: 'UUID' },
    },
  }
}

export default getDataOutMetadata
