import { check_inbox, Email } from 'gmail-tester'
import path from 'path'

export const checkGmail = async ({
  from,
  to,
  subject,
}: {
  from: string
  to: string
  subject?: string
}): Promise<Email[]> => {
  // slient unnecessary logging from the library
  // eslint-disable-next-line no-console
  const oldLog = console.log
  // eslint-disable-next-line no-console, @typescript-eslint/no-empty-function
  console.log = function () {}
  const emails = await check_inbox(
    path.resolve(__dirname, 'credentials.json'),
    path.resolve(__dirname, 'gmail_token.json'),
    {
      subject,
      from,
      to,
      wait_time_sec: 10,
      max_wait_time_sec: 60,
      include_body: true,
      after: new Date(),
    },
  )
  // eslint-disable-next-line no-console
  console.log = oldLog
  return emails
}
