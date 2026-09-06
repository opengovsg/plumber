/**
 * one.gov.sg authenticates any officer. Plumber still only admits OGP mailboxes
 * over this login path, matching the previous OGP SSO gate.
 */
export function isAllowedSsoEmail(email: string): boolean {
  return email.endsWith('@open.gov.sg')
}
