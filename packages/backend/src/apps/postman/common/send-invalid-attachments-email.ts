import { truncateFlowName } from '@/helpers/generate-error-email'
import { sendEmail } from '@/helpers/send-email'

interface SendInvalidAttachmentsEmailProps {
  flowName: string
  userEmail: string
  executionId: string
  submissionId: string
  invalidAttachments: string[]
}

interface CreateMessageProps {
  flowName: string
  invalidAttachments: string[]
  executionId: string
  submissionId: string
}

export function createInvalidAttachmentsMessage(props: CreateMessageProps) {
  const { flowName, invalidAttachments, executionId, submissionId } = props

  const bodyMessage = `
    We have detected that your pipe <strong>${flowName}</strong> has attempted to send an email with one or more attachments that are not supported:
    <ul>
        ${invalidAttachments.map((a) => `<li>${a}</li>`).join('\n')}
    </ul>
    The details of the affected execution are as follows:
    <ul>
      <li>Execution ID: ${executionId}</li>
      <li>Form Submission ID: ${submissionId}</li>
    </ul>
    <p>What should you do?</p>
    <ul>
      <li>If you require the attachment(s), log in to your form to download them for this submission.</li>
    </ul>

  `
  return bodyMessage
}

export async function sendInvalidAttachmentsEmail(
  props: SendInvalidAttachmentsEmailProps,
) {
  const { flowName, userEmail } = props
  const truncatedFlowName = truncateFlowName(flowName)
  const bodyContent = createInvalidAttachmentsMessage(props)

  const bodyMessage = `
    Dear fellow plumber,
    <br>
    <br>
    ${bodyContent}
    Regards,
    <br>
    Plumber team
  `

  await sendEmail({
    subject: `Plumber: Unsupported attachment(s) detected on ${truncatedFlowName}`,
    body: bodyMessage,
    recipient: userEmail,
    replyTo: 'support@plumber.gov.sg',
  })
  return
}
