import type { IJSONObject, IUserAddedConnectionAuth } from '@plumber/types'

import { BadUserInputError } from '@/errors/graphql-errors'

const CUSTOM_API_KEY = 'custom-api'
const CUSTOM_API_HEADERS_KEY = 'headers'

function isBlank(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  )
}

function serializeHeaders(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ''
  }

  return Object.entries(value)
    .map(([key, headerValue]) => `${key}=${String(headerValue)}`)
    .join('\n')
}

export default function buildConnectionEditCandidate({
  appKey,
  auth,
  storedData,
  submittedData,
}: {
  appKey: string
  auth: IUserAddedConnectionAuth
  storedData?: IJSONObject
  submittedData: IJSONObject
}): IJSONObject {
  const candidate: IJSONObject = {}

  for (const field of auth.fields ?? []) {
    const submittedValue = submittedData[field.key]

    if (field.required && isBlank(submittedValue)) {
      throw new BadUserInputError(`${field.label} is required`)
    }

    if (
      appKey === CUSTOM_API_KEY &&
      field.key === CUSTOM_API_HEADERS_KEY &&
      isBlank(submittedValue)
    ) {
      candidate[field.key] = serializeHeaders(storedData?.[field.key])
      continue
    }

    if (submittedValue !== undefined) {
      candidate[field.key] = submittedValue
    }
  }

  return candidate
}
