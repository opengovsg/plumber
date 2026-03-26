import z from 'zod/v3'

export const schema = z.object({
  // NOTE: this is an array because the attachment field returns an array
  image: z
    .array(z.string())
    .min(1, { message: 'An image must be selected' })
    .refine((value) => value.length === 1, {
      message: 'Only one image allowed',
    }),
  responseFields: z
    .array(
      z.object({
        fieldName: z
          .string()
          .min(1, { message: 'Field name is required' })
          .max(64, { message: 'Field name cannot be more than 64 characters' })
          .regex(/^[a-zA-Z0-9_-]+$/, {
            message:
              'Field name cannot contain spaces. Use only letters, numbers, underscores (_), and hyphens (-)',
          }),

        description: z
          .string()
          .min(1, { message: 'Description is required' })
          .max(128, {
            message: 'Description cannot be more than 128 characters',
          }),
      }),
    )
    .min(1, { message: 'At least one response field is required' })
    .refine(
      (fields) => {
        const names = fields.map((f) => f.fieldName.toLowerCase())
        return new Set(names).size === names.length
      },
      {
        message: 'Field names must be unique (case-insensitive)',
      },
    ),
})
