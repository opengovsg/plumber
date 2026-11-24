import logger from '@/helpers/logger'

export type UnsupportedPayloadReason =
  | 'unknown_answer_shape'
  | 'unparsable_date'
  | 'unknown_verified_key'

/**
 * Flags a FormSG payload shape Plumber cannot map, usually after an upstream
 * format change.
 *
 * IMPORTANT: never pass answer values. They are respondent PII.
 */
export function logUnsupportedPayload(
  reason: UnsupportedPayloadReason,
  details: {
    formId: string
    fieldId?: string
    fieldType?: string
    key?: string
  },
): void {
  logger.warn('Unsupported FormSG payload', {
    event: 'formsg-unsupported-payload',
    reason,
    ...details,
  })
}
