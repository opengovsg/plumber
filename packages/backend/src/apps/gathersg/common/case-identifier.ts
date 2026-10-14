import type { IGlobalVariable } from '@plumber/types'

import { z } from 'zod'

import StepError from '@/errors/step'
import logger from '@/helpers/logger'

import { CASE_REF_REGEX, CASE_UUID_REGEX } from './constants'

/**
 * Case detail and update APIs only accept a case uuid.
 * A case ref has to be resolved through search first.
 */
export const caseIdentifierSchema = z
  .string()
  .trim()
  .min(1, {
    message: 'Please do not leave the case uuid or case ref empty',
  })
  .refine(
    (value) => CASE_UUID_REGEX.test(value) || CASE_REF_REGEX.test(value),
    {
      message: 'Please enter a valid case uuid or case ref',
    },
  )

const caseSearchHitSchema = z.object({
  uuid: z.string().trim().min(1),
})

/**
 * Paginated Gather lists return records on `data`.
 * Some responses nest that page under another `data` object.
 */
const caseSearchResponseSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== 'object') {
      return value
    }

    const body = value as Record<string, unknown>
    if (Array.isArray(body.data)) {
      return body
    }

    const nested = body.data
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) {
      return body
    }

    const page = nested as Record<string, unknown>
    if (!Array.isArray(page.data)) {
      return body
    }

    return {
      data: page.data,
      total: typeof page.total === 'number' ? page.total : body.total,
    }
  },
  z.object({
    data: z.array(caseSearchHitSchema),
    total: z.number().optional(),
  }),
)

export function isCaseRef(value: string): boolean {
  return CASE_REF_REGEX.test(value)
}

/**
 * StepError stores its user-facing text in a JSON message.
 * Dynamic data callers need the plain text, not that payload.
 */
export function readStepErrorName(error: StepError): string {
  try {
    const parsed = JSON.parse(error.message) as { name?: unknown }
    if (typeof parsed.name === 'string' && parsed.name) {
      return parsed.name
    }
  } catch {
    // Fall through when the message is not the StepError payload.
  }

  return 'Unknown error'
}

export async function resolveCaseIdentifier(
  $: IGlobalVariable,
  caseIdentifier: string,
): Promise<string> {
  if (CASE_UUID_REGEX.test(caseIdentifier)) {
    return caseIdentifier
  }

  const { data } = await $.http.post('/cases/search', {
    caseRefs: [caseIdentifier],
    page: 1,
    size: 10,
  })

  const parsed = caseSearchResponseSchema.safeParse(data)
  if (!parsed.success) {
    logger.error(
      `Case search response for case ref ${caseIdentifier} did not match the expected shape`,
    )
    throw new StepError(
      `Unable to read the case search result for case ref ${caseIdentifier}`,
      'Please check that you have configured your step correctly',
    )
  }

  const uuids = [
    ...new Set(
      parsed.data.data
        .map((item) => item.uuid)
        .filter((uuid) => CASE_UUID_REGEX.test(uuid)),
    ),
  ]
  const matchCount = Math.max(parsed.data.total ?? 0, uuids.length)

  if (matchCount > 1) {
    throw new StepError(
      `More than one case found for case ref ${caseIdentifier}`,
      'Please ensure that the case ref is valid',
    )
  }

  if (uuids.length !== 1) {
    throw new StepError(
      `No case found for case ref ${caseIdentifier}`,
      'Please ensure that the case ref is valid',
    )
  }

  return uuids[0]
}
