import type {
  DemoVideoDetails,
  ITemplate,
  ITemplateStep,
  TileTemplateData,
} from '@plumber/types'

import { z } from 'zod'

const jsonObjectSchema = z.record(z.string(), z.json())

export const templateStepSchema = z.object({
  position: z.number().int().positive(),
  appKey: z.string().optional(),
  eventKey: z.string().optional(),
  sampleUrl: z.string().url().optional(),
  sampleUrlDescription: z.string().optional(),
  parameters: jsonObjectSchema.optional(),
  config: z
    .object({
      stepName: z.string().optional(),
      approval: z
        .object({ branch: z.literal('reject'), stepId: z.string() })
        .optional(),
      endStepId: z.string().optional(),
      adminOverride: jsonObjectSchema.optional(),
    })
    .default({}),
}) satisfies z.ZodType<ITemplateStep>

const tileTemplateDataSchema = z.object({
  name: z.string(),
  columns: z.array(z.string()),
  rowData: z.array(jsonObjectSchema).optional(),
}) satisfies z.ZodType<TileTemplateData>

const demoVideoDetailsSchema = z.object({
  url: z.string().url(),
  title: z.string(),
}) satisfies z.ZodType<DemoVideoDetails>

export const templateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  steps: z.array(templateStepSchema),
  iconName: z.string().optional(),
  tags: z.array(z.enum(['demo', 'empty', 'new'])).optional(),
  tileTemplateData: tileTemplateDataSchema.optional(),
  demoVideoDetails: demoVideoDetailsSchema.optional(),
}) satisfies z.ZodType<ITemplate>
