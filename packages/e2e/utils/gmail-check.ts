import { check_inbox, type Email } from 'gmail-tester'

import { GMAIL_CREDENTIALS, GMAIL_TOKEN } from '../config'

export const checkGmail = async ({
  from,
  to,
  subject,
  includeAttachments,
  retrieveSince,
}: {
  from?: string
  to: string
  subject?: string
  includeAttachments?: boolean
  retrieveSince?: Date
}): Promise<Email[]> => {
  // slient unnecessary logging from the library

  const oldLog = console.log

  console.log = function () {}
  const emails = await check_inbox(GMAIL_CREDENTIALS, GMAIL_TOKEN, {
    subject,
    from,
    to,
    wait_time_sec: 10,
    max_wait_time_sec: 60,
    include_body: true,
    include_attachments: includeAttachments,
    after: retrieveSince ? retrieveSince : new Date(),
  })

  console.log = oldLog
  return emails
}
