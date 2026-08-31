import { z } from 'zod'

import { parseS3Id } from '@/helpers/s3'

import { caseFieldsSchema } from '../../common/case-fields-schema'
import { CASE_UUID_REGEX } from '../../common/constants'

const attachmentS3IdsSchema = z
  .array(z.string())
  .transform((array, context) => {
    const result: string[] = []
    for (const value of array) {
      // A file-type variable resolves to "" when the upstream step
      // produced no file; skip these empty entries.
      if (!value) {
        continue
      }
      // parseS3Id returns null for non-S3 ids and throws on path
      // traversal; treat both as an invalid attachment.
      let parsedS3Id: ReturnType<typeof parseS3Id> = null
      try {
        parsedS3Id = parseS3Id(value)
      } catch {
        parsedS3Id = null
      }
      if (!parsedS3Id) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${value} is not a S3 ID.`,
        })
        return z.NEVER
      }
      result.push(value)
    }
    return result
  })

const attachmentUpdateRowSchema = z.object({
  field: z.string().trim(),
  replaceExisting: z.boolean().default(false),
  attachments: attachmentS3IdsSchema,
})
export const requestSchema = z
  .preprocess(
    (raw) => {
      const data = raw as Record<string, unknown>
      if (
        typeof data.attachmentField === 'string' &&
        data.attachmentField.trim() &&
        data.attachmentUpdates == null
      ) {
        const { attachmentField, attachments, ...rest } = data
        return {
          ...rest,
          attachmentUpdates: [
            {
              field: attachmentField,
              replaceExisting: false,
              attachments: attachments ?? [],
            },
          ],
        }
      }
      return raw
    },
    z.object({
      caseUuid: z
        .string()
        .trim()
        .min(1, {
          message: 'Please do not leave the case uuid empty',
        })
        .regex(CASE_UUID_REGEX, {
          message: 'Please enter a valid case uuid',
        }),
      caseStatus: z.string().trim().optional(),
      caseFields: caseFieldsSchema.nullish(),
      attachmentUpdates: z
        .array(attachmentUpdateRowSchema)
        .superRefine((rows, context) => {
          const seenFields = new Set<string>()
          for (const [index, row] of rows.entries()) {
            const hasField = !!row.field?.trim()
            const hasAttachments = row.attachments.length > 0

            if (!hasField && !hasAttachments) {
              continue
            }

            if (hasField !== hasAttachments) {
              context.addIssue({
                code: z.ZodIssueCode.custom,
                message: hasField
                  ? 'Please add at least one attachment for the selected field.'
                  : 'Please select an attachment field for your attachments.',
                path: [index, hasField ? 'attachments' : 'field'],
              })
            }

            if (hasField && seenFields.has(row.field)) {
              context.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${row.field} attachment field is repeated`,
                path: [index, 'field'],
              })
            }
            if (hasField) {
              seenFields.add(row.field)
            }
          }
        })
        .transform((rows) =>
          rows.filter(
            (row) => row.field.trim().length > 0 && row.attachments.length > 0,
          ),
        )
        .nullish(),
    }),
  )
  .transform((data) => ({
    caseUuid: data.caseUuid,
    ...(data.caseStatus && { status: data.caseStatus }),
    fields: data.caseFields,
    attachmentUpdates: data.attachmentUpdates ?? [],
  }))

// TODO: See if its possible to get more data from the response in the future if necessary
export const responseSchema = z.object({
  traceId: z.string(),
})
