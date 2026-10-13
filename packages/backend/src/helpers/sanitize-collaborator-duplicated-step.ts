import { IJSONObject, IJSONValue } from '@plumber/types'

import { omit } from 'lodash'

import { isSensitiveHeaderName } from '@/apps/custom-api/common/sensitive-headers'

type ParameterSanitizer = (parameters: IJSONObject) => IJSONObject

type ClearedColumnRow = IJSONObject & { columnId: '' }

// Tiles column IDs belong to one table, so they can never match the table
// the user picks for the copy.
function clearColumnIds(rows: IJSONValue): ClearedColumnRow[] | undefined {
  if (!Array.isArray(rows)) {
    return undefined
  }
  const items: unknown[] = rows
  return items
    .filter(
      (row): row is IJSONObject =>
        !!row && typeof row === 'object' && !Array.isArray(row),
    )
    .map((row) => ({ ...row, columnId: '' as const }))
}

/**
 * IMPORTANT: Editors and Viewers who duplicate a Pipe must not receive the
 * owner's files, tables or secrets. Update this list when an app stores one
 * of these in step parameters.
 */
const COLLABORATOR_DUPLICATE_SANITIZERS: Record<string, ParameterSanitizer> = {
  'm365-excel': (parameters) =>
    omit(parameters, ['fileId', 'worksheetId', 'tableId']),
  tiles: (parameters) => {
    const sanitized: IJSONObject = omit(parameters, ['tableId'])
    for (const key of ['rowData', 'filters']) {
      const cleared = clearColumnIds(sanitized[key])
      if (cleared) {
        sanitized[key] = cleared
      }
    }
    return sanitized
  },
  gathersg: (parameters) => omit(parameters, ['encryptionKey']),
  'custom-api': (parameters) => {
    const { customHeaders } = parameters
    if (!Array.isArray(customHeaders)) {
      return parameters
    }
    return {
      ...parameters,
      customHeaders: customHeaders.filter((row) => {
        const key = (row as IJSONObject | null)?.key
        return !(typeof key === 'string' && isSensitiveHeaderName(key))
      }),
    }
  },
}

export function sanitizeCollaboratorDuplicatedParameters(
  appKey: string | null | undefined,
  parameters: IJSONObject,
): IJSONObject {
  const sanitize = appKey ? COLLABORATOR_DUPLICATE_SANITIZERS[appKey] : null
  return sanitize ? sanitize(parameters ?? {}) : parameters
}
