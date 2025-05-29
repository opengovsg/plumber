import { truncateFlowName } from '@/helpers/generate-error-email'
import { sendEmail } from '@/helpers/send-email'
import ExecutionStep from '@/models/execution-step'

interface SendInvalidAttachmentsEmailProps {
  flowName: string
  flowId: string
  userEmail: string
  executionId: string
  submissionId: string
  invalidAttachments: string[]
}

interface CreateMessageProps extends SendInvalidAttachmentsEmailProps {
  formAdminLink: string
}

function createFormAdminLink({ formId }: { formId: string }) {
  return `https://form.gov.sg/admin/form/${formId}/results`
}

async function getFormId(executionId: string) {
  const formData = await ExecutionStep.query()
    .where('execution_id', executionId)
    .where('app_key', 'formsg')
    .first()
    .select('data_out')

  return String(formData?.dataOut?.formId)
}

async function createMessage(props: CreateMessageProps) {
  const {
    flowName,
    invalidAttachments,
    executionId,
    submissionId,
    formAdminLink,
  } = props

  const bodyMessage = `
    Dear fellow plumber,
    <br>
    <br>
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
    Regards,
    <br>
    Plumber team
  `
  return bodyMessage
}

export async function sendInvalidAttachmentsEmail(
  props: SendInvalidAttachmentsEmailProps,
) {
  const { flowName, userEmail } = props
  const truncatedFlowName = truncateFlowName(flowName)
  const formId = await getFormId(props.executionId)
  const formAdminLink = createFormAdminLink({ formId })
  const bodyMessage = await createMessage({ ...props, formAdminLink })

  await sendEmail({
    subject: `Plumber: Invalid attachments detected on ${truncatedFlowName}`,
    body: bodyMessage,
    recipient: userEmail,
    replyTo: 'support@plumber.gov.sg',
  })
  return { formAdminLink }
}
