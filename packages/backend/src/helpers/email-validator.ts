import validator from 'email-validator'

import LoginWhitelistEntry from '@/models/login-whitelist-entry'

export async function validateAndParseEmail(
  input: unknown,
): Promise<string | false> {
  if (typeof input !== 'string') {
    return false
  }
  const email = input.toLowerCase().trim()
  if (!validator.validate(email)) {
    return false
  }

  // Short circuit as .gov.sg always allowed.
  if (email.endsWith('.gov.sg')) {
    return email
  }

  return (await LoginWhitelistEntry.isWhitelisted(email)) ? email : false
}
