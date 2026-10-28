import { z } from 'zod'

const isolationSchema = z.object({
  REDIS_DB_OFFSET: z.coerce.number().int().min(0).default(0),
  DYNAMODB_TABLE_SUFFIX: z
    .string()
    .regex(/^w\d+$/)
    .optional(),
})

// IMPORTANT: Only honoured under vitest, so a stray value in a deployed env
// cannot move Redis DBs or the tiles table.
export const integrationTestIsolation = process.env.VITEST
  ? isolationSchema.parse(process.env)
  : { REDIS_DB_OFFSET: 0, DYNAMODB_TABLE_SUFFIX: undefined }
