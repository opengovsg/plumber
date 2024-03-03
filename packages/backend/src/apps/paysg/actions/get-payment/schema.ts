import { z } from 'zod'

export const requestSchema = z.object({
  paymentId: z.string().trim().min(1, { message: 'Specify a payment ID' }),
})

export { schema as responseSchema } from '../../common/schemas/payment'
