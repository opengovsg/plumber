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
      .nullish(),
    createdBy: z
      .object({
        email: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        role: z.string().min(1).optional(),
        uuid: z.string().min(1).optional(),
      })
      .nullish(),
    formsg: z
      .object({
        formId: z.string().min(1),
        submissionId: z.string().min(1),
      })
      .nullish(),
    fields: z.record(z.string(), z.any()).nullish(),
  })
  .refine(
    (data) => {
      const { updatedBy, createdBy, formsg } = data || {}

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
        // when the createdBy.name is 'FormSG', there will not be a createdBy.email
        // as the case is created by a FormSG submission.
        if (
          createdBy?.name === 'FormSG' &&
          formsg?.formId &&
          formsg?.submissionId
        ) {
          return true
        }

        // when the case is auto-created from an inbound email, Gather sends a
        // sentinel createdBy of exactly { name: 'Email', role: 'email', uuid: 'email' }
        // instead of a real user's email.
        if (
          createdBy?.name === 'Email' &&
          createdBy?.role === 'email' &&
          createdBy?.uuid === 'email'
        ) {
          return true
        }

        // otherwise, check for createdBy.email
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
