import MailComposer from 'nodemailer/lib/mail-composer'

export interface RawEmailInput {
  /** RFC 5322 From address, e.g. `Display Name <addr@domain>`. */
  from: string
  /**
   * Omit to build a recipient-agnostic message (no `To:` header) that can be
   * shared across recipients — combine with `withRecipient` to add the header
   * per recipient without rebuilding the whole message.
   */
  to?: string
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
    ...(input.to && { to: input.to }),
    ...(input.cc?.length && { cc: input.cc }),
    ...(input.replyTo && { replyTo: input.replyTo }),
    subject: input.subject,
    html: input.html,
    attachments: input.attachments.map((attachment) => ({
      filename: attachment.fileName,
      content: Buffer.from(attachment.data),
      // Force a real download. Without this, nodemailer defaults
      // Content-Disposition to 'inline' for any content type it detects as
      // message/* (e.g. .eml -> message/rfc822), which makes mail clients
      // render the attachment as a nested email instead of a downloadable
      // file. None of our attachments are ever inline/cid-embedded images.
      contentDisposition: 'attachment' as const,
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

/**
 * Cheaply add a `To:` header to a message built without one (`to` omitted
 * from `buildRawEmail`'s input), so the expensive part of building a message
 * (base64-encoding attachments) can happen once and be reused per recipient.
 *
 * Safe because the header block isn't terminated until the first blank line,
 * and `buildRawEmail` never emits one before the first real header.
 */
export function withRecipient(rawMessage: Buffer, to: string): Buffer {
  return Buffer.concat([Buffer.from(`To: ${to}\r\n`, 'utf-8'), rawMessage])
}
