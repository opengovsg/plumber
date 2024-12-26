import type { IFieldDropdown } from '@plumber/types'

import z from 'zod'

import { ensureZodObjectKey } from '@/helpers/zod-utils'

import {
  commonDateFormatOptions,
  commonDateFormats,
} from '../../common/date-format-options'

export const fieldSchema = z.object({
  formatDateTimeToFormat: z.enum(commonDateFormats),
})

export const field = {
  key: ensureZodObjectKey(fieldSchema, 'formatDateTimeToFormat'),
  label: 'What format do you want to transform value to?',
  type: 'dropdown' as const,
  required: true,
  variables: false,
  showOptionValue: false,
  options: commonDateFormatOptions,
} satisfies IFieldDropdown
