const TRUSTED_ORIGIN = 'https://s3.ap-southeast-1.amazonaws.com'
const TRUSTED_PATH_PREFIX = '/attachments.form.gov.sg/'

function isTrusted(url: string): boolean {
  try {
    const { origin, pathname } = new URL(url)

    return origin === TRUSTED_ORIGIN && pathname.startsWith(TRUSTED_PATH_PREFIX)
  } catch {
    // Malformed enough that URL cannot parse it, so it is not FormSG's bucket.
    return false
  }
}

/**
 * Attachment download URLs arrive in the webhook body, so a forged one could
 * aim Plumber at an internal service. Only FormSG's bucket is allowed.
 *
 * Comparing origin covers scheme, host and port at once. Parsing also
 * normalises `..`, so traversal cannot climb out of the bucket prefix.
 */
export function areAttachmentUrlsTrusted(
  attachmentDownloadUrls: Record<string, string>,
): boolean {
  return Object.values(attachmentDownloadUrls).every(isTrusted)
}
