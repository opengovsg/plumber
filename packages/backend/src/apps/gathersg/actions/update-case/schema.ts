import { z } from 'zod'

import { parseS3Id } from '@/helpers/s3'

import { CASE_UUID_REGEX } from '../../common/constants'

export const fieldTypeEnum = z.enum(['string', 'number', 'null'])

const attachmentS3IdsSchema = z.array(z.string()).transform((array, context) => {
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
  .preprocess((raw) => {
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
  }, z.object({
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
    caseFields: z
      .array(
        z.object({
          field: z.string().trim().min(1, 'Field empty'),
          // we add nullish here because defaultValue or value doesnt work properly in dropdown
          fieldType: fieldTypeEnum.nullish(),
          value: z.string().trim().nullish(),
        }),
      )
      .transform((params, context) => {
        const result: Record<string, string | number | null> =
          Object.create(null)
        const seenFields = new Set<string>()
        for (const { field, fieldType, value } of params) {
          /**
           * No null fields are allowed
           * For now, we allow them to keep the field empty to set back to null. But in the future, may need to have a way to set to null vs set to empty string
           */
          if (!field) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Field empty',
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

          // Right now, we will attempt to parse the value to the field type
          if (fieldType === 'null') {
            result[field] = null
          } else if (fieldType === 'number') {
            const parsedValue = Number(value)
            if (isNaN(parsedValue)) {
              context.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Invalid number type for field: ${field}`,
              })
              return z.NEVER
            }
            result[field] = parsedValue
          } else {
            result[field] = value
          }
        }
        return result
      })
      .nullish(),
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
  }))
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
