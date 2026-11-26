// SES accepts messages up to 40MB after base64 encoding (~1.37x), so 20MB of
// raw attachments (~27MB encoded) stays under it. Postman's own limit is lower.
export const MAX_TOTAL_ATTACHMENT_SIZE_MB = 20
export const MAX_TOTAL_ATTACHMENT_SIZE =
  MAX_TOTAL_ATTACHMENT_SIZE_MB * 1024 * 1024

// Matched by name in getSesErrorStatus.
export class AttachmentSizeExceededError extends Error {
  constructor() {
    super(`Total attachment size exceeds ${MAX_TOTAL_ATTACHMENT_SIZE_MB}MB`)
    this.name = 'AttachmentSizeExceededError'
  }
}
