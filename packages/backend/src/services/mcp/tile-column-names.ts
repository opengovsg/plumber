import { UserFacingError } from '@/errors/user-facing-error'

export interface TileColumnResult {
  id: string
  name: string
  position: number
}
export const MAX_TILE_NAME_LENGTH = 64
export const MAX_COLUMN_NAME_LENGTH = 255
export const MAX_COLUMNS_PER_CALL = 50

const COLUMN_NAME_CHARSET = /^[a-zA-Z0-9 _\-!@#$%^&*()+=[\]{};:'",.<>/?|~]+$/

export function parseTileName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new UserFacingError('Tile name is required')
  }
  if (trimmed.length > MAX_TILE_NAME_LENGTH) {
    throw new UserFacingError(
      `Tile name must be ${MAX_TILE_NAME_LENGTH} characters or fewer`,
    )
  }
  return trimmed
}

export function parseColumnNames(columns: string[]): string[] {
  if (columns.length < 1 || columns.length > MAX_COLUMNS_PER_CALL) {
    throw new UserFacingError(
      `Provide between 1 and ${MAX_COLUMNS_PER_CALL} column names`,
    )
  }

  const names = columns.map((column) => {
    const trimmed = column.trim()
    if (!trimmed) {
      throw new UserFacingError('Column names cannot be empty')
    }
    if (trimmed.length > MAX_COLUMN_NAME_LENGTH) {
      throw new UserFacingError(
        `Column names must be ${MAX_COLUMN_NAME_LENGTH} characters or fewer`,
      )
    }
    if (!COLUMN_NAME_CHARSET.test(trimmed)) {
      throw new UserFacingError(
        'Column names can only include letters, numbers, spaces, and common special characters',
      )
    }
    return trimmed
  })

  const seen = new Set<string>()
  for (const name of names) {
    const key = name.toLowerCase()
    if (seen.has(key)) {
      throw new UserFacingError(`Duplicate column name: ${name}`)
    }
    seen.add(key)
  }

  return names
}
