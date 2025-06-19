import { z } from 'zod'

const RowDataSchema = z.object({
  rows: z.array(
    z.object({
      data: z.record(z.string(), z.union([z.string(), z.number()])),
      rowId: z.string().optional(), // only Tiles will have this
    }),
  ),
  columns: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      value: z.string(),
    }),
  ),
})

export const ExecutionStepDataOutSchema = z.object({
  rowsFound: z.union([z.string(), z.number()]).default('0'),
  data: RowDataSchema,
})
