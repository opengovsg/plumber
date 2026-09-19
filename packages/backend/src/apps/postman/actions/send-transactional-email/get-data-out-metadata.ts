import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut } = executionStep
  if (!dataOut) {
    return null
  }

  const metadata: IDataOutMetadata = {
    subject: {
      label: 'Email subject',
      order: 1,
    },
    body: {
      label: 'Body',
      order: 2,
      type: 'email',
      displayedValue: 'Preview body',
    },
    recipient: {
      label: 'Recipient email(s)',
      order: 3,
      type: 'array',
    },
    status: {
      label: 'Status',
      order: 4,
      type: 'array',
    },
    cc: {
      label: 'CC recipient email(s)',
      order: 5,
      type: 'array',
    },
    ccStatus: {
      label: 'CC status',
      order: 6,
      type: 'array',
    },
    from: {
      label: 'Sender',
      order: 7,
    },
    reply_to: {
      label: 'Reply-To email',
      order: 8,
    },
  }

  return metadata
}

export default getDataOutMetadata
