import { z } from 'zod'

import { UserFacingError } from '@/errors/user-facing-error'
import { firstZodParseError } from '@/helpers/zod-utils'
import {
  MAX_COLUMN_NAME_LENGTH,
  MAX_TILE_NAME_LENGTH,
} from '@/models/tiles/constants'

export interface TileColumnResult {
  id: string
  name: string
  position: number
}

/** MCP-only cap. updateTable does not limit how many columns a call may add. */
export const MAX_COLUMNS_PER_CALL = 50

const tileNameSchema = z
  .string()
  .trim()
  .min(1, 'Tile name is required')
  .max(
    MAX_TILE_NAME_LENGTH,
    `Tile name must be ${MAX_TILE_NAME_LENGTH} characters or fewer`,
  )

const columnNameSchema = z
  .string()
  .trim()
  .min(1, 'Column names cannot be empty')
  .max(
    MAX_COLUMN_NAME_LENGTH,
    `Column names must be ${MAX_COLUMN_NAME_LENGTH} characters or fewer`,
  )

const columnNamesSchema = z
  .array(columnNameSchema)
  .min(1, `Provide between 1 and ${MAX_COLUMNS_PER_CALL} column names`)
  .max(
    MAX_COLUMNS_PER_CALL,
    `Provide between 1 and ${MAX_COLUMNS_PER_CALL} column names`,
  )
  .superRefine((names, ctx) => {
    const seen = new Set<string>()
    for (const name of names) {
      const key = name.toLowerCase()
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate column name: ${name}`,
        })
      }
      seen.add(key)
    }
  })

const createTileFieldsSchema = z.object({
  name: tileNameSchema,
  columns: columnNamesSchema,
  pipeId: z.uuid().optional(),
})

const addTileColumnsFieldsSchema = z.object({
  /**
   * Table and column ids are UUIDs. PG tile row ids are ULIDs.
   * Accept both so an id copied from either layer still validates.
   */
  tableId: z.union([z.uuid(), z.ulid()]),
  columns: columnNamesSchema,
})

function parseOrThrow<TSchema extends z.ZodType>(
  schema: TSchema,
  data: unknown,
): z.infer<TSchema> {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new UserFacingError(firstZodParseError(result.error))
  }
  return result.data
}

export function parseTileName(name: string): string {
  return parseOrThrow(tileNameSchema, name)
}

export function parseColumnNames(columns: string[]): string[] {
  return parseOrThrow(columnNamesSchema, columns)
}

export function parseCreateTileInput(input: {
  name: string
  columns: string[]
  pipeId?: string
}): z.infer<typeof createTileFieldsSchema> {
  return parseOrThrow(createTileFieldsSchema, input)
}

export function parseAddTileColumnsInput(input: {
  tableId: string
  columns: string[]
}): z.infer<typeof addTileColumnsFieldsSchema> {
  return parseOrThrow(addTileColumnsFieldsSchema, input)
}
