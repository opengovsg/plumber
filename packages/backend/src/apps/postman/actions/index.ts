import sendEmailWithOldEditor from './send-email-raw-html'
import sendEmailWithAttachments from './send-email-with-attachments'
import sendTransactionalEmail from './send-transactional-email'

export default [
  sendTransactionalEmail,
  sendEmailWithAttachments,
  sendEmailWithOldEditor,
]
