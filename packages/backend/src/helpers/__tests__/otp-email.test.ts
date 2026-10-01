import { describe, expect, it } from 'vitest'

import { renderOtpEmailHtml } from '../otp-email'
import { sanitizeEmailHtml } from '../sanitize-email-html'

describe('renderOtpEmailHtml', () => {
  it('renders the OTP and validity period', () => {
    const html = renderOtpEmailHtml('AB23CD', 15)
    expect(html).toContain('AB23CD')
    expect(html).toContain('expires in 15 minutes')
  })

  it('survives email sanitisation unchanged', () => {
    const html = renderOtpEmailHtml('AB23CD', 15)
    // The sanitizer only re-spaces `;` in style attributes.
    expect(sanitizeEmailHtml(html).replace(/; /g, ';')).toBe(html)
  })
})
