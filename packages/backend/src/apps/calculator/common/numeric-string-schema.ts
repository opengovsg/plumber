import z from 'zod'

export const numericStringSchema = z
  .string({
    required_error: 'No value found',
  })
  .trim()
  .min(1, { message: 'No value found' })
  .transform((amount) => Number(amount))
  .pipe(z.number({ invalid_type_error: 'Enter a number' }))
