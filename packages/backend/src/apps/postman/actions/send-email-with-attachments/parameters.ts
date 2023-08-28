import { IField } from '@plumber/types'

import validator from 'email-validator'
import { z } from 'zod'

import { parseS3Id } from '@/helpers/s3'

import {
  transactionalEmailFields,
  transactionalEmailSchema,
} from '../../common/parameters'

export const fields: IField[] = [
  ...transactionalEmailFields,
  {
    label: 'Attachments',
    key: 'attachments',
    type: 'multiselect' as const,
    required: false,
    variables: true,
    variableTypes: ['file'],
  },
]

export const schema = transactionalEmailSchema.merge(
  z.object({
    fromAddress: z.nullable(
      z
        .string()
        .trim()
        .transform((email, context) => {
          if (!email) {
            return null
          }
          if (!validator.validate(email)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Invalid from address',
            })
            return z.NEVER
          }
          return email
        }),
    ),
    attachments: z.array(z.string()).transform((array, context) => {
      const result: string[] = []
      for (const value of array) {
        // Account for optional attachment fields with no response.
        if (!value) {
          continue
        }
        if (!parseS3Id(value)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${value} is not a S3 ID.`,
          })
          return z.NEVER
        }
        result.push(value)
      }
      return result
    }),
  }),
)
