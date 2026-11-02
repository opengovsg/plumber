import { describe, expect, it } from 'vitest'

import { buildRawEmail, withRecipient } from '../../common/build-raw-mime'

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

  it('omits the To header when to is not provided', async () => {
    const raw = await build({ ...baseInput, to: undefined })

    expect(raw).not.toMatch(/^To:/m)
  })

  it('sends a .eml attachment as a downloadable file, not an inline nested message', async () => {
    const raw = await build({
      ...baseInput,
      attachments: [
        { fileName: 'original.eml', data: new Uint8Array([1, 2, 3]) },
      ],
    })

    // nodemailer defaults message/* content types (which .eml resolves to)
    // to Content-Disposition: inline unless overridden — assert we override it.
    expect(raw).toContain('message/rfc822')
    expect(raw).toMatch(/Content-Disposition: attachment/i)
    expect(raw).not.toMatch(/Content-Disposition: inline/i)
  })
})

describe('withRecipient', () => {
  it('prepends a To header without disturbing the rest of the message', async () => {
    const raw = await buildRawEmail({ ...baseInput, to: undefined })
    const withTo = withRecipient(raw, ['dave@open.gov.sg']).toString('utf-8')

    expect(withTo).toMatch(/^To: dave@open\.gov\.sg\r\n/)
    expect(withTo).toContain('multipart/mixed')
    expect(withTo).toContain('report.pdf')
  })

  it('reuses the exact same body/attachments when adding different To headers', async () => {
    const shared = await buildRawEmail({ ...baseInput, to: undefined })

    const forAlice = withRecipient(shared, ['alice@open.gov.sg']).toString(
      'utf-8',
    )
    const forBob = withRecipient(shared, ['bob@open.gov.sg']).toString('utf-8')

    // Only the prepended To: line should differ between the two.
    expect(forAlice.replace(/^To:.*\r\n/, '')).toEqual(
      forBob.replace(/^To:.*\r\n/, ''),
    )
    expect(forAlice).toMatch(/^To: alice@open\.gov\.sg\r\n/)
    expect(forBob).toMatch(/^To: bob@open\.gov\.sg\r\n/)
  })

  it('joins several recipients into one To header', async () => {
    const raw = await buildRawEmail({ ...baseInput, to: undefined })
    const withTo = withRecipient(raw, [
      'alice@open.gov.sg',
      'bob@open.gov.sg',
    ]).toString('utf-8')

    expect(withTo).toMatch(/^To: alice@open\.gov\.sg, bob@open\.gov\.sg\r\n/)
  })

  it('folds a 50-address To header so no line exceeds SES limits', async () => {
    const to = Array.from(
      { length: 50 },
      (_, i) => `recipient-number-${i}@some-agency.gov.sg`,
    )
    const raw = await buildRawEmail({
      ...baseInput,
      to: undefined,
      cc: Array.from({ length: 20 }, (_, i) => `cc-${i}@some-agency.gov.sg`),
    })
    const withTo = withRecipient(raw, to).toString('utf-8')

    const toHeader = withTo.match(/^To:.*?\r\n(?! )/s)![0]
    for (const line of toHeader.split('\r\n').slice(0, -1)) {
      expect(line.length).toBeLessThanOrEqual(78)
    }
    // RFC 5322's hard limit, below SES's 1,000. Also covers the Cc header.
    for (const line of withTo.split('\r\n')) {
      expect(line.length).toBeLessThanOrEqual(998)
    }
    // Unfolding (dropping each CRLF before a space) must restore every address.
    expect(toHeader.replace(/\r\n(?= )/g, '')).toEqual(
      `To: ${to.join(', ')}\r\n`,
    )
  })
})
