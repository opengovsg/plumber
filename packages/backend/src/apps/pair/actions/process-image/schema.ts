import z from 'zod/v3'

export const schema = z.object({
  // NOTE: this is an array because the attachment field returns an array
  image: z.array(z.string()).refine((value) => value.length === 1, {
    message: 'Only one image allowed',
  }),
  responseFields: z
    .array(
      z.object({
        fieldName: z
          .string()
          .min(1)
          .max(64)
          .regex(
            /^[a-zA-Z0-9_-]+$/,
            'Field name cannot contain spaces. Use only letters, numbers, underscores (_), and hyphens (-)',
          ),

        description: z.string().min(1).max(128),
      }),
    )
    .optional()
    .default([]),
})
