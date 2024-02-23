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
          field: z.string().min(1, 'Please do not leave the field empty'),
          value: z.string().min(1, 'Please do not leave the value empty'),
        }),
      )
      .transform((params) =>
        params.reduce((acc, { field, value }) => {
          acc[field] = value
          return acc
        }, {} as Record<string, string>),
      )
      .nullish(),
    recipientEmail: z.preprocess((value) => {
      if (typeof value !== 'string') {
        return value
      }
      return value.trim() === '' ? undefined : value.trim()
    }, z.string().email('Please key in a valid email address').optional()),
  })
  .transform((data) => ({
    templateId: Number(data.templateId),
    letterParams: data.letterParams,
    ...(data.recipientEmail && {
      notificationParams: {
        recipient: data.recipientEmail,
        notificationMethod: 'email',
      },
    }),
  }))

export const responseSchema = z
  .object({
    publicId: z.string().nullish(),
    letterLink: z.string().nullish(),
    issuedLetter: z.string().nullish(),
    createdAt: z.string().nullish(),
  })
  .transform((data) => ({
    publicId: data.publicId,
    letterLink: data.letterLink,
    issuedLetter: data.issuedLetter,
    createdAt: DateTime.fromFormat(data.createdAt, 'EEE MMM dd yyyy').toFormat(
      'dd MMM yyyy', // format a time usable for other steps
    ),
  }))
