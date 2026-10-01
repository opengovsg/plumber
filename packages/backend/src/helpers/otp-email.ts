import { escapeHtml } from './html-utils'

// Layout mirrors the opengovsg/suite sign-in code email.
// IMPORTANT: Postman and sanitizeEmailHtml strip non-`style` table attributes and
// CSS outside the xss allowlist (e.g. line-height, vertical-align).

const CANVAS = '#f8f9fa'
const CARD = '#ffffff'
const INK = '#272d41'
const BODY = '#465173'
const MUTED = '#7b849c'
const RULE = '#e9eaee'
const BRAND = '#cf1a68'
const CHIP = '#f9dde9'

const SANS = "Inter, 'Trebuchet MS', -apple-system, Arial, sans-serif"
const MONO = "'IBM Plex Mono', Courier, Monaco, 'Courier New', monospace"

const LOGO_URL = 'https://file.go.gov.sg/plumber-logo.png'

export const OTP_EMAIL_SUBJECT = 'Your Plumber sign-in code'

export function renderOtpEmailHtml(
  otp: string,
  validityInMinutes: number,
): string {
  return `<table style="width:100%;background-color:${CANVAS};margin:0;padding:0;border-collapse:collapse;">
  <tr>
    <td style="padding:32px 16px;text-align:center;font-family:${SANS};">
      <table style="width:480px;max-width:100%;margin:0 auto;text-align:left;background-color:${CARD};border:1px solid ${RULE};border-radius:12px;border-collapse:separate;border-spacing:0;">
        <tr>
          <td style="padding:32px 32px 0 32px;">
            <table style="border-collapse:collapse;">
              <tr>
                <td style="padding:0;">
                  <img src="${LOGO_URL}" alt="Plumber" height="28" style="display:block;height:28px;width:auto;border:0;" />
                </td>
                <td style="padding:0 0 0 8px;font-family:${SANS};font-size:20px;font-weight:700;color:${BRAND};">
                  Plumber
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 0 32px;font-family:${SANS};font-size:24px;font-weight:600;color:${INK};letter-spacing:-0.019em;">
            Your sign-in code
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 0 32px;">
            <table style="width:100%;background-color:${CHIP};border-radius:8px;border-collapse:separate;border-spacing:0;">
              <tr>
                <td style="padding:20px 16px;text-align:center;font-family:${MONO};font-size:32px;font-weight:700;color:${INK};letter-spacing:0.12em;">
                  ${escapeHtml(otp)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 0 32px;font-family:${SANS};font-size:16px;color:${BODY};">
            This code expires in ${validityInMinutes} minutes and can only be used once. Enter it only on the official Plumber sign-in page.
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 0 32px;font-family:${SANS};font-size:14px;color:${BODY};">
            If you did not request this code, you can safely ignore this email.
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 32px 32px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="border-top:1px solid ${RULE};padding-top:16px;font-family:${SANS};font-size:12px;color:${MUTED};">
                  Plumber is a no-code workflow automation tool by Open Government Products.
                  This is an automated message. Please do not reply.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
}
