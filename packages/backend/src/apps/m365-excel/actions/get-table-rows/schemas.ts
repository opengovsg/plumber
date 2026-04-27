import z from 'zod'

import { FOR_EACH_INPUT_SOURCE } from '@/apps/toolbox/common/constants'

import { lookupParametersSchema } from '../../common/schema'

// Use the validated lookup parameters schema from common
export const parametersSchema = lookupParametersSchema

export const dataOutSchema = z.object({
  rowsFound: z.number(),
  data: z.object({
    rows: z.array(z.object({ data: z.record(z.string(), z.string()) })),
    columns: z.array(
      z.object({ id: z.string(), name: z.string(), value: z.string() }),
    ),
    inputSource: z.literal(FOR_EACH_INPUT_SOURCE.M365_EXCEL),
  }),
})
