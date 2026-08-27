/**
 * Header names that typically carry credentials. Keep in sync with
 * packages/backend/src/apps/custom-api/common/sensitive-headers.ts
 */
const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'proxy-authorization',
  'api-key',
  'x-api-key',
  'x-apikey',
  'apikey',
  'x-auth-token',
  'x-access-token',
  'access-token',
  'auth-token',
  'x-secret-key',
  'secret-key',
])

const STEP_VARIABLE_REGEXP =
  /{{step\.[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}(?:\.[\da-zA-Z-_ ]+)+(?:\|[a-fA-F0-9]+)?}}/i

export type CustomHeaderRow = {
  key?: string | null
  value?: string | null
}

export function isSensitiveHeaderName(key: string): boolean {
  return SENSITIVE_HEADER_NAMES.has(key.trim().toLowerCase())
}

export function hasStepVariable(value: string | null | undefined): boolean {
  if (!value) {
    return false
  }
  return STEP_VARIABLE_REGEXP.test(value)
}

export function getStaticSensitiveHeaderKeys(
  customHeaders: CustomHeaderRow[] | null | undefined,
): string[] {
  if (!customHeaders?.length) {
    return []
  }

  const found: string[] = []
  const seen = new Set<string>()

  for (const row of customHeaders) {
    const key = row?.key?.trim()
    if (!key || !isSensitiveHeaderName(key)) {
      continue
    }
    if (hasStepVariable(row.value)) {
      continue
    }
    const dedupeKey = key.toLowerCase()
    if (seen.has(dedupeKey)) {
      continue
    }
    seen.add(dedupeKey)
    found.push(key)
  }

  return found
}
