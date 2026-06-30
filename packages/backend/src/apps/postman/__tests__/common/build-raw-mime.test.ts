import { describe, expect, it } from 'vitest'

import { buildRawEmail } from '../../common/build-raw-mime'

const baseInput = {
  from: 'HR <hr@plumber.gov.sg>',
  to: 'alice@open.gov.sg',
  subject: 'Monthly report',
  html: '<p>Hello</p>',
  attachments: [{ fileName: 'report.pdf', data: new Uint8Array([1, 2, 3, 4]) }],
  headers: { 'X-Plumber-Transport': 'ses' },
}

async function build(input: Parameters<typeof buildRawEmail>[0]) {
  return (await buildRawEmail(input)).toString('utf-8')
}

describe('buildRawEmail', () => {
  it('builds a multipart/mixed message with the html body and transport header', async () => {
    const raw = await build(baseInput)

    expect(raw).toContain('multipart/mixed')
    expect(raw).toContain('X-Plumber-Transport: ses')
    expect(raw).toContain('text/html')
  })

  it('includes each attachment as a part carrying its filename', async () => {
    const raw = await build({
      ...baseInput,
      attachments: [
        { fileName: 'report.pdf', data: new Uint8Array([1, 2, 3]) },
        { fileName: 'data.csv', data: new Uint8Array([65, 66, 67]) },
      ],
    })

    expect(raw).toMatch(/Content-Disposition: attachment/i)
    expect(raw).toContain('report.pdf')
    expect(raw).toContain('data.csv')
  })

  it('sets From, To, Cc and Reply-To headers', async () => {
    const raw = await build({
      ...baseInput,
      from: 'HR <hr@plumber.gov.sg>',
      to: 'alice@open.gov.sg',
      cc: ['bob@open.gov.sg', 'carol@open.gov.sg'],
      replyTo: 'noreply@open.gov.sg',
    })

    expect(raw).toMatch(/^From: HR <hr@plumber\.gov\.sg>/m)
    expect(raw).toMatch(/^To: alice@open\.gov\.sg/m)
    expect(raw).toContain('bob@open.gov.sg')
    expect(raw).toContain('carol@open.gov.sg')
    expect(raw).toMatch(/^Reply-To: noreply@open\.gov\.sg/m)
  })

  it('RFC 2047-encodes a non-ASCII subject instead of emitting raw UTF-8', async () => {
    const raw = await build({ ...baseInput, subject: '报告 — 月度' })

    expect(raw).toMatch(/Subject: =\?UTF-8\?/i)
    expect(raw).not.toContain('报告 — 月度')
  })

  it('encodes a non-ASCII attachment filename rather than emitting it raw', async () => {
    const raw = await build({
      ...baseInput,
      attachments: [{ fileName: '报告.pdf', data: new Uint8Array([1, 2, 3]) }],
    })

    expect(raw).not.toContain('报告.pdf')
    // RFC 2231 encoded filename: `filename*=`, or the continuation `filename*0*=`.
    expect(raw.toLowerCase()).toMatch(/filename(\*\d+)?\*?=/)
  })
})
