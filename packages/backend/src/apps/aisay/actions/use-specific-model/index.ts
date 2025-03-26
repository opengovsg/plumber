import { IJSONArray, IRawAction } from '@plumber/types'

import StepError from '@/errors/step'
import { getObjectFromS3Id } from '@/helpers/s3'

import { getToken } from '../../auth/get-token'

import getDataOutMetadata from './get-data-out-metadata'
import { requestSchema } from './schema'

const uint8ArrayToBase64 = (uint8Array: Uint8Array) => {
  return Buffer.from(uint8Array).toString('base64')
}

const action: IRawAction = {
  name: 'Use specific model',
  key: 'callSpecificModel',
  description:
    'For documents with standard formats: Receipt, Invoices, Quotation, Bank Statement, Transfer Advice, Passport, Cheque',
  arguments: [
    {
      label: 'Attachments',
      key: 'attachments',
      description: 'Use files from previous steps',
      type: 'multiselect' as const,
      required: false,
      variables: true,
      variableTypes: ['file'],
    },
    {
      label: 'Document Type',
      key: 'documentType',
      type: 'dropdown',
      options: [
        { label: 'Bank Statement', value: 'BANK_STATEMENT' },
        { label: 'Cheque', value: 'CHEQUE' },
        { label: 'Invoice', value: 'INVOICE' },
        { label: 'Passport', value: 'PASSPORT' },
        { label: 'Receipt', value: 'RECEIPT' },
      ],
      showOptionValue: false,
      required: true,
    },
  ],
  getDataOutMetadata,

  async run($) {
    const { attachments, documentType } = $.step.parameters as {
      attachments?: IJSONArray
      documentType: string
    }

    const result = requestSchema.safeParse({ attachments, documentType })

    if (!$.auth.data.clientId || !$.auth.data.clientSecret) {
      throw new StepError(
        'Missing client ID or client secret',
        'Please check the client ID and client secret',
        $.step.position,
        $.app.name,
      )
    }

    if (!result.success) {
      throw new StepError(
        'Invalid attachments',
        'Please check the attachments field',
        $.step.position,
        $.app.name,
      )
    }

    try {
      // Pre-call get attachments from S3 first
      const attachmentFiles = await Promise.all(
        result.data.attachments?.map(async (attachment) => {
          // We verify the flowId here to ensure that the attachment is from the same flow and not
          // maliciously/ manually injected by another user who does not have access to this attachment
          const obj = await getObjectFromS3Id(attachment, { flowId: $.flow.id })
          return { fileName: obj.name, data: uint8ArrayToBase64(obj.data) }
        }),
      )
      const attachment = attachmentFiles[0]

      // Step 1: get AWS Cognito access token
      const token = await getToken($)

      // Assuming we do a synchronous call to the model
      // which needs to be less than 29 seconds
      // and with a document size of less than 9 MB
      // Step 2: Call the model to get the output
      const aisayRes = await $.http.request({
        url: 'https://stg.ai.ff.gov.sg/query',
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        data: {
          document_type: result.data.documentType,
          image: attachment.data,
        },
      })

      $.setActionItem({
        raw: { ...aisayRes.data, documentType: result.data.documentType },
      })
    } catch (err) {
      if (
        err.response.data.message ===
        `Quota exceeded for id ${$.auth.data.clientId}: 0 of 0 used, with current request of 1 pages`
      ) {
        throw new StepError(
          'Quota exceeded',
          'Please contact AISAY to increase your quota.',
          $.step.position,
          $.app.name,
        )
      } else {
        throw new StepError(
          'Failed to call specific model',
          'Please try again.',
          $.step.position,
          $.app.name,
        )
      }
    }
  },
} satisfies IRawAction

export default action
