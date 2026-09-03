import { SENSITIVE_HEADER_NAMES } from '@/helpers/redaction/sensitive-keys'

/**
 * Same shape as the variable regex in compute-parameters.ts. Auth headers built
 * from a previous step's output are allowed: connections only hold static
 * KEY=VALUE pairs, so they cannot express a token fetched at runtime.
 */
const STEP_VARIABLE_REGEXP =
  /{{step\.[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}(?:\.[\da-zA-Z-_ ]+)+(?:\|[a-fA-F0-9]+)?}}/i

type CustomHeaderRow = {
  key?: string | null
  value?: string | null
}

export const SENSITIVE_HEADERS_ERROR = 'Do not store secrets in Custom Headers'

export const SENSITIVE_HEADERS_SOLUTION =
  'Create a Custom API connection and move these headers there. Connections keep credentials encrypted, while Custom Headers are stored as plain text.'

export function isSensitiveHeaderName(key: string): boolean {
  return SENSITIVE_HEADER_NAMES.has(key.trim().toLowerCase())
}

export function hasStepVariable(value: string | null | undefined): boolean {
  if (!value) {
    return false
  }
  return STEP_VARIABLE_REGEXP.test(value)
}

export function getStaticSensitiveHeaderKeys(customHeaders: unknown): string[] {
  if (!Array.isArray(customHeaders)) {
    return []
  }

  const found: string[] = []
  const seen = new Set<string>()

  for (const row of customHeaders as CustomHeaderRow[]) {
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
