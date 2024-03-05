import { z } from 'zod'

export const parametersSchema = z.object({
  script: z.string().min(1, { message: 'Script cannot be empty' }),
})
