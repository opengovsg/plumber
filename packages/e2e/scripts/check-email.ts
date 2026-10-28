import 'dotenv/config'
import { MAILBOX } from '../config'
import { checkGmail } from '../utils/gmail-check'

const main = async () => {
  try {
    console.log('Checking for emails in the last hour...\n')

    // Get emails from the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    const emails = await checkGmail({
      to: MAILBOX,
      retrieveSince: oneHourAgo,
    })

    console.log(`Found ${emails.length} emails in the last hour`)
    console.log(`Displaying emails:\n`)

    emails.forEach((email, index) => {
      console.log(`--- Email ${index + 1} ---`)
      console.log(`From: ${email.from}`)
      console.log(`Subject: ${email.subject}`)
      console.log(
        `Date: ${email.date ? new Date(email.date).toISOString() : 'No date'}`,
      )
      console.log(`Body: ${email.body?.text || email.body?.html || 'No body'}`)
      console.log('\n')
    })
  } catch (error) {
    console.error('Error checking emails:', error)
    process.exit(1)
  }
}

void main()
