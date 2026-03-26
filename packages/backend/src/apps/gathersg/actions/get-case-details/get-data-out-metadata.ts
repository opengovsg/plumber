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
      updatedAt: { label: 'Updated at' },
      createdBy: createUserMetadata(dataOut?.createdBy, 'Created by'),
      updatedBy: createUserMetadata(dataOut?.updatedBy, 'Updated by'),
      finalisedBy: createUserMetadata(dataOut?.finalisedBy, 'Finalised by'),
      durationSec: { isHidden: true },
      durationPaused: { isHidden: true },
      email: {
        subject: { label: 'Email subject' },
        sender: {
          name: { label: 'Email sender (name)' },
          address: { label: 'Email sender (email)' },
        },
      },
      formsg: createFormSgMetadata(dataOut?.formsg),
    },
  }

  const tagsMetadata = createTagMetadata(dataOut)
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
