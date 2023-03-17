import validator from 'email-validator'

export function validateAndParseEmail(input: unknown): string | false {
  if (typeof input !== 'string') {
    return false
  }
  const email = input.toLowerCase().trim()
  if (!validator.validate(email) || !email.endsWith('.gov.sg')) {
    return false
  }
  return email
}
