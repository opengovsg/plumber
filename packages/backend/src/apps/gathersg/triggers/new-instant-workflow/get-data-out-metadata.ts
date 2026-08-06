import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

import {
  createFieldMetadata,
  createOptionalNestedMetadata,
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
  const formSgMetadata = createOptionalNestedMetadata(dataOut?.formsg, {
    formId: 'FormSG (form ID)',
    submissionId: 'FormSG (submission ID)',
  })

  // Built inline rather than via createOptionalNestedMetadata: createdBy's
  // role/uuid are only ever sentinel values (e.g. when a case is auto-created
  // from an inbound email), so they must always stay hidden rather than
  // getting a label. createOptionalNestedMetadata expects a single label per
  // key, so forcing role/uuid through it would mean passing throwaway label
  // strings that could accidentally leak into the UI if the hiding logic is
  // ever refactored away.
  const createdByMetadata = dataOut?.createdBy
    ? {
        email: { label: 'Created by (email)' },
        name: { label: 'Created by (name)' },
        role: { isHidden: true },
        uuid: { isHidden: true },
      }
    : { isHidden: true }

  const updatedByMetadata = createOptionalNestedMetadata(dataOut?.updatedBy, {
    email: 'Updated by (email)',
    name: 'Updated by (name)',
  })

  const finalisedByMetadata = createOptionalNestedMetadata(
    dataOut?.finalisedBy,
    {
      email: 'Finalised by (email)',
      name: 'Finalised by (name)',
    },
  )

  const attachmentsMetadata: Record<string, any> = {}
  const attachmentKeys: string[] = []
  if (dataOut?.attachments) {
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
    ...caseMetadata,
    data: {
      fields: fieldsMetadata,
      formsg: formSgMetadata,
      createdBy: createdByMetadata,
      finalisedBy: finalisedByMetadata,
      updatedBy: updatedByMetadata,
      attachments: attachmentsMetadata,

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
