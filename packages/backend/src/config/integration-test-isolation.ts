import { z } from 'zod'

const isolationSchema = z.object({
  REDIS_DB_OFFSET: z.coerce.number().int().min(0).default(0),
  // IMPORTANT: redlock only selects DBs 0-15.
  REDIS_APP_DATA_DB: z.coerce.number().int().min(0).max(15).optional(),
  DYNAMODB_TABLE_SUFFIX: z
    .string()
    .regex(/^w\d+$/)
    .optional(),
})

// IMPORTANT: Only honoured under vitest, so a stray value in a deployed env
// cannot move Redis DBs or the tiles table.
export const integrationTestIsolation = process.env.VITEST
  ? isolationSchema.parse(process.env)
  : {
      REDIS_DB_OFFSET: 0,
      REDIS_APP_DATA_DB: undefined,
      DYNAMODB_TABLE_SUFFIX: undefined,
    }
