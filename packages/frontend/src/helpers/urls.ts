/**
 * We dont want to open relative links which auto-resolve to the current domain
 */
export function makeExternalLink(url: string) {
  return ['http://', 'https://', 'mailto:', 'tel:', 'sms:'].some((prefix) =>
    url.startsWith(prefix),
  )
    ? url
    : `https://${url}`
}
