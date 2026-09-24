import type { IField } from '@plumber/types'

interface GetNoOptionsMessageParams {
  field: IField
  options: unknown[] | null | undefined
  loading: boolean
  failed: boolean
  /**
   * Whether the source query still needs a value from another field, e.g. a
   * table list that only resolves once a file is picked.
   */
  missingSourceArguments: boolean
}

/**
 * Guidance to show under a source-backed dropdown that resolved to no options.
 *
 * IMPORTANT: a failed query and an unanswered parent field both yield zero
 * options too, so neither shows the message.
 */
export function getNoOptionsMessage({
  field,
  options,
  loading,
  failed,
  missingSourceArguments,
}: GetNoOptionsMessageParams): string | undefined {
  if (field.type !== 'dropdown' || !field.source || !field.noOptionsMessage) {
    return undefined
  }

  if (loading || failed || missingSourceArguments || options?.length) {
    return undefined
  }

  return field.noOptionsMessage
}
