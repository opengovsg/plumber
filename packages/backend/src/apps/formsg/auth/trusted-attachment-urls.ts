import type { FormEnv } from '../common/form-env'

const TRUSTED_ORIGIN = 'https://s3.ap-southeast-1.amazonaws.com'

// Prod attachments sit directly under attachments.form.gov.sg, without a
// `prod.` env segment, since that env predates the other form.gov.sg envs.
function getTrustedPathPrefix(formEnv: FormEnv): string {
  return formEnv === 'prod'
    ? '/attachments.form.gov.sg/'
    : `/attachments.${formEnv}.form.gov.sg/`
}

function isTrusted(url: string, formEnv: FormEnv): boolean {
  try {
    const { origin, pathname } = new URL(url)

    return (
      origin === TRUSTED_ORIGIN &&
      pathname.startsWith(getTrustedPathPrefix(formEnv))
    )
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
  formEnv: FormEnv,
): boolean {
  return Object.values(attachmentDownloadUrls).every((url) =>
    isTrusted(url, formEnv),
  )
}
