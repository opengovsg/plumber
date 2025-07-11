import { z } from 'zod'

// Define specific schemas for each input type
const tableInputSchema = z.object({
  rows: z.array(
    z.object({
      data: z.record(z.string(), z.string().or(z.number())),
      rowId: z.string().optional(), // only for tiles
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

// Create a discriminated union based on input format
export const inputSchema = z
  .union([z.array(z.any()), tableInputSchema])
  .transform((data, ctx) => {
    if (!data || (Array.isArray(data) && data.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Input cannot be empty',
      })
      return z.NEVER
    }

    if (Array.isArray(data)) {
      return {
        type: 'checkbox' as const,
        items: data,
      }
    } else {
      return {
        type: 'table' as const,
        items: data,
      }
    }
  })
