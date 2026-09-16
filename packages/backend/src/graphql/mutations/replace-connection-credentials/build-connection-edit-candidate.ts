import type { IJSONObject, IUserAddedConnectionAuth } from '@plumber/types'

import { z, ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { BadUserInputError } from '@/errors/graphql-errors'

const CUSTOM_API_KEY = 'custom-api'
const CUSTOM_API_HEADERS_KEY = 'headers'

function isBlankString(value: string | undefined): boolean {
  return value === undefined || value.trim() === ''
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

function submittedDataSchema(auth: IUserAddedConnectionAuth) {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const field of auth.fields ?? []) {
    const message = `${field.label} is required`
    const value = z.string({ error: message }).trim()
    shape[field.key] = field.required ? value.min(1, message) : value.optional()
  }

  return z.object(shape).strip()
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
  submittedData: Record<string, unknown>
}): IJSONObject {
  try {
    const parsed = submittedDataSchema(auth).parse(submittedData) as Record<
      string,
      string | undefined
    >
    const candidate: IJSONObject = {}

    for (const field of auth.fields ?? []) {
      const submittedValue = parsed[field.key]

      if (
        appKey === CUSTOM_API_KEY &&
        field.key === CUSTOM_API_HEADERS_KEY &&
        isBlankString(submittedValue)
      ) {
        candidate[field.key] = serializeHeaders(storedData?.[field.key])
        continue
      }

      if (submittedValue !== undefined) {
        candidate[field.key] = submittedValue
      }
    }

    return candidate
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadUserInputError(
        fromZodError(error).details[0]?.message ?? 'Invalid connection data',
      )
    }
    throw error
  }
}
