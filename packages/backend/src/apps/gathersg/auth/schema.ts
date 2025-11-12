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
        // does not have email when update is done by an instant workflow
        email: z.string().min(1).nullish(),
        name: z.string().min(1),
      })
      .nullish(),
    createdBy: z
      .object({
        email: z.string().min(1).nullish(),
        name: z.string().min(1).nullish(),
      })
      .nullish(),
    formsg: z
      .object({
        formId: z.string().min(1),
        submissionId: z.string().min(1),
      })
      .nullish(),
  })
  .refine(
    (data) => {
      const { updatedBy, createdBy, formsg } = data || {}

      // if updatedBy exists, check updatedBy first
      if (updatedBy) {
        if (updatedBy.name === 'Workflow') {
          /**
           * SPECIAL CASE
           * if the workflow has an update step before calling the webhook,
           * the webhook will return with:
           * {
           *   updatedBy: {
           *     name: 'Workflow',
           *   },
           * }
           *
           * Best effort check that createdBy must contain both email and name
           * to know that its not an API creating the case and an instant workflow
           * calling Plumber again.
           */
          return !updatedBy.email && !!createdBy?.email && !!createdBy?.name
        }
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
