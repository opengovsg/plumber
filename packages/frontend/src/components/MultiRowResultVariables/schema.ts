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

export const VariableToRowDataSchema = z
  .object({
    value: z.string(),
  })
  .transform((variable) => {
    try {
      return JSON.parse(variable.value)
    } catch {
      throw new Error('Invalid JSON in variable value')
    }
  })
  .pipe(RowDataSchema)
