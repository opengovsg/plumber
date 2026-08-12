import z from 'zod'

export const numericStringSchema = z
  .string({
    error: 'No value found',
  })
  .trim()
  .min(1, { error: 'No value found' })
  .transform((amount) => Number(amount))
  .pipe(z.number({ error: 'Enter a number' }))
