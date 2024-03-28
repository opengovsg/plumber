import { z } from 'zod'

export const parametersSchema = z.object({
  code: z.string().min(1, { message: 'Script cannot be empty' }),
})
