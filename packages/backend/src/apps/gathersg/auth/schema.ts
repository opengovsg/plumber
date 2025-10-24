import { z } from 'zod'

/**
 * check for potential infinite loop
 * if the webhook is not triggered by a user, it will not contain
 * the user's email and name in the payload.
 */
const schema = z
  .object({
    updatedBy: z
      .object({
        email: z.string().min(1),
        name: z.string().min(1),
      })
      .optional(),
    createdBy: z
      .object({
        email: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
      })
      .optional(),
  })
  .refine(
    (data) => {
      const { updatedBy, createdBy } = data || {}

      // if both updatedBy and createdBy exist, only check updatedBy.email
      if (updatedBy && createdBy) {
        return !!updatedBy.email
      }

      // if updatedBy exists, check for updatedBy.email
      if (updatedBy) {
        return !!updatedBy.email
      }

      // if only createdBy exists, check for createdBy.email
      if (createdBy) {
        return !!createdBy.email
      }

      // neither exists
      return false
    },
    {
      message:
        'When only createdBy exists, createdBy.email is required. When updatedBy exists, updatedBy.email is required.',
    },
  )

export default schema
