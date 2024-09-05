import { DateTime } from 'luxon'
import { z } from 'zod'

export const requestSchema = z
  .object({
    templateId: z.string().trim().min(1, {
      message: 'Please do not leave the template id empty',
    }),
    letterParams: z
      .array(
        z.object({
          field: z.string().trim().min(1, 'Field empty').nullish(),
          value: z.string().trim().min(1, 'Value empty').nullish(),
        }),
      )
      .transform((params, context) => {
        const result: Record<string, string> = Object.create(null)
        const seenFields = new Set<string>()
        for (const { field, value } of params) {
          // no null fields or values are allowed
          if (!field) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Field empty',
            })
            return z.NEVER
          }
          if (!value) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Value empty',
            })
            return z.NEVER
          }
          // catch duplicate fields
          if (seenFields.has(field)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${field} field is repeated`,
              fatal: true,
            })
            return z.NEVER
          }
          seenFields.add(field)
          result[field] = value
        }
        return result
      })
      .nullish(),
  })
  .transform((data) => ({
    templateId: Number(data.templateId),
    letterParams: data.letterParams,
  }))

export const responseSchema = z
  .object({
    publicId: z.string(),
    letterLink: z.string(),
    issuedLetter: z.string(),
    createdAt: z.string(),
  })
  .transform((data) => ({
    publicId: data.publicId,
    letterLink: data.letterLink,
    issuedLetter: data.issuedLetter,
    // Have to set to en-US to process the month "Sep" while en-SG only accepts "Sept"
    createdAt: DateTime.fromFormat(data.createdAt, 'EEE MMM dd yyyy', {
      locale: 'en-US',
    }).toFormat(
      'dd MMM yyyy', // format a time usable for other steps
    ),
  }))

export const dataOutSchema = z.object({
  publicId: z.string(),
  letterLink: z.string(),
  issuedLetter: z.string(),
  createdAt: z.string(),
  attachment: z.string().optional(),
})
