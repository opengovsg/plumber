import { MAX_TOTAL_ATTACHMENT_SIZE_MB } from '@plumber/shared'

// Matched by name in getSesErrorStatus.
export class AttachmentSizeExceededError extends Error {
  constructor() {
    super(`Total attachment size exceeds ${MAX_TOTAL_ATTACHMENT_SIZE_MB}MB`)
    this.name = 'AttachmentSizeExceededError'
  }
}
