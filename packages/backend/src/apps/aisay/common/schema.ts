import { z } from 'zod'

import { parseS3Id } from '@/helpers/s3'

import {
  DEFAULT_GENERALISED_MODEL_TYPE,
  DOCUMENT_TYPES,
  GENERALISED_MODEL_OPTIONS,
} from './constants'

export const fileSchema = z.string().transform((value, context) => {
  if (!value) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'No file was provided',
      fatal: true,
    })
    return z.NEVER
  }
  if (!parseS3Id(value)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${value} is not a S3 ID.`,
      fatal: true,
    })
    return z.NEVER
  }
  return value
})

export const generalisedModelSchema = z.object({
  file: fileSchema,
  prompts: z.array(z.object({ prompt: z.string() })).transform((array) => {
    const result: Record<string, { description: string; type: string }> = {}
    array.forEach((a, index) => {
      result[`additionalProp${index}`] = {
        description: `Extract the ${a.prompt}`,
        type: 'string',
      }
    })
    return result
  }),
  modelType: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) {
        return null
      }

      const allowedValues = GENERALISED_MODEL_OPTIONS.map(
        (option) => option.value,
      ).filter((value) => value !== DEFAULT_GENERALISED_MODEL_TYPE)

      if (!allowedValues.includes(value)) {
        return null
      }
      return { [value]: {} }
    }),
})

export const documentTypeEnum = z.enum(DOCUMENT_TYPES as [string, ...string[]])

export const specificModelSchema = z.object({
  file: fileSchema,
  documentType: documentTypeEnum,
})
