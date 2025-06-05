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
  .string()
  .min(1, 'Input cannot be empty')
  .transform((str, ctx) => {
    const trimmed = str.trim()

    if (trimmed.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Input cannot be empty',
      })
      return z.NEVER
    }

    // Handle table input (JSON object)
    if (trimmed.startsWith('{') || trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed)
        const result = tableInputSchema.safeParse(parsed)

        if (!result.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid table format: must have rows and columns',
          })
          return z.NEVER
        }

        return {
          type: 'table' as const,
          items: result.data,
        }
      } catch (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid JSON format',
        })
        return z.NEVER
      }
    }

    // Handle checkbox input (comma-separated values)
    const items = trimmed.split(',')

    if (items.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'No valid items found in comma-separated input',
      })
      return z.NEVER
    }

    return {
      type: 'checkbox' as const,
      items,
    }
  })
