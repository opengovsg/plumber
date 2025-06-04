import { truncateFlowName } from '@/helpers/generate-error-email'
import { sendEmail } from '@/helpers/send-email'
import ExecutionStep from '@/models/execution-step'

interface SendInvalidAttachmentsEmailProps {
  flowName: string
  userEmail: string
  executionId: string
  submissionId: string
  invalidAttachments: string[]
  formAdminLink: string
}

interface CreateMessageProps {
  flowName: string
  invalidAttachments: string[]
  executionId: string
  submissionId: string
  formAdminLink: string
}

export async function getFormId(executionId: string) {
  const formData = await ExecutionStep.query()
    .where('execution_id', executionId)
    .where('app_key', 'formsg')
    .first()
    .select('data_out')

  return String(formData?.dataOut?.formId)
}

export function createInvalidAttachmentsMessage(props: CreateMessageProps) {
  const {
    flowName,
    invalidAttachments,
    executionId,
    submissionId,
    formAdminLink,
  } = props

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
      <li>If you require the attachment(s), log in to your <a href="${formAdminLink}">form</a> to download them for this submission.</li>
    </ul>

  `
  return bodyMessage
}

export async function sendInvalidAttachmentsEmail(
  props: SendInvalidAttachmentsEmailProps,
) {
  const { flowName, userEmail, formAdminLink } = props
  const truncatedFlowName = truncateFlowName(flowName)
  const bodyContent = await createInvalidAttachmentsMessage({
    ...props,
    formAdminLink,
  })

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
  return { formAdminLink }
}
