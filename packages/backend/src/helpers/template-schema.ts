import type {
  DemoVideoDetails,
  ITemplate,
  ITemplateStep,
  TemplateData,
} from '@plumber/types'
import { z } from 'zod'

import { getTemplateDataHandler } from './template-data'

const jsonObjectSchema = z.record(z.string(), z.json())

export const templateStepSchema = z
  .object({
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
    // The app event's template data handler validates the shape.
    templateData: z.custom<TemplateData>().optional(),
  })
  .superRefine((step, ctx) => {
    if (step.templateData === undefined) {
      return
    }
    // NOTE: Error out if there's `templateData` for this (app key, event key)
    // but no configured `handler`
    const handler = getTemplateDataHandler(step.appKey, step.eventKey)
    if (!handler) {
      ctx.addIssue({
        code: 'custom',
        message: 'This app event does not support template data',
        path: ['templateData'],
      })
      return
    }
    for (const issue of handler.schema.safeParse(step.templateData).error
      ?.issues ?? []) {
      ctx.addIssue({ ...issue, path: ['templateData', ...issue.path] })
    }
  }) satisfies z.ZodType<ITemplateStep>

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
  demoVideoDetails: demoVideoDetailsSchema.optional(),
}) satisfies z.ZodType<ITemplate>
