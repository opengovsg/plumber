import MailComposer from 'nodemailer/lib/mail-composer'

export interface RawEmailInput {
  /** RFC 5322 From address, e.g. `Display Name <addr@domain>`. */
  from: string
  to: string
  cc?: string[]
  replyTo?: string
  subject: string
  /** HTML body — caller is responsible for sanitising it. */
  html: string
  attachments: { fileName: string; data: Uint8Array }[]
  /** Extra top-level headers, e.g. `{ 'X-Plumber-Transport': 'ses' }`. */
  headers?: Record<string, string>
}

/**
 * Build a complete RFC 5322 (raw MIME) message for an email with attachments,
 * suitable for SES `SendEmailCommand` with `Content.Raw`.
 *
 * Uses nodemailer's MailComposer purely as a message builder (not its SES
 * transport), so the existing SES client, configuration set, metrics and
 * suppression checks around the send call are preserved. MailComposer handles
 * the encoding details we'd otherwise get wrong by hand: RFC 2047 encoded-words
 * for non-ASCII subjects/filenames, base64 line wrapping, and MIME boundaries.
 */
export function buildRawEmail(input: RawEmailInput): Promise<Buffer> {
  const composer = new MailComposer({
    from: input.from,
    to: input.to,
    ...(input.cc?.length && { cc: input.cc }),
    ...(input.replyTo && { replyTo: input.replyTo }),
    subject: input.subject,
    html: input.html,
    attachments: input.attachments.map((attachment) => ({
      filename: attachment.fileName,
      content: Buffer.from(attachment.data),
    })),
    ...(input.headers && { headers: input.headers }),
  })

  return new Promise((resolve, reject) => {
    composer.compile().build((err, message) => {
      if (err) {
        reject(err)
        return
      }
      resolve(message)
    })
  })
}
