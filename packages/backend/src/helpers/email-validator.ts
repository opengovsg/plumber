import validator from 'email-validator'
import assert from 'node:assert'

// FIXME (ogp-weeloong): Remove after VAPT
function getWhitelistedEmails(): ReadonlyArray<string> {
  try {
    const emails = JSON.parse(process.env.WHITELISTED_EMAILS)
    assert(Array.isArray(emails))
    return emails
  } catch {
    return []
  }
}

const WHITELISTED_EMAILS = getWhitelistedEmails()

export function validateAndParseEmail(input: unknown): string | false {
  if (typeof input !== 'string') {
    return false
  }
  const email = input.toLowerCase().trim()
  if (
    !validator.validate(email) ||
    !(email.endsWith('.gov.sg') || WHITELISTED_EMAILS.includes(email))
  ) {
    return false
  }
  return email
}
