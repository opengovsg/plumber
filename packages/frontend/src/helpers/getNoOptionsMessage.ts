import type { IField } from '@plumber/types'

interface GetNoOptionsMessageParams {
  field: IField
  options: unknown[] | null | undefined
  loading: boolean
  failed: boolean
  // True until every field the source reads has a value, e.g. file before tables.
  missingSourceArguments: boolean
}

/**
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
