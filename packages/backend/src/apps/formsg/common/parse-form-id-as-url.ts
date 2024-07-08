export default function parseFormIdAsUrl(rawUrl: string): URL | null {
  try {
    const url = new URL(
      rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`,
    )

    return url.hostname === 'form.gov.sg' ||
      url.hostname.endsWith('.form.gov.sg')
      ? url
      : null
  } catch {
    return null
  }
}
