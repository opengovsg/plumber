import { IField } from '@plumber/types'

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
