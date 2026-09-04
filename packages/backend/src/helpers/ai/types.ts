import type {
  IFlowSteps,
  IFlowStepsAction,
  IFlowStepsTrigger,
} from '@plumber/types'
import { z } from 'zod'

const triggerStepSchema = z.object({
  type: z.literal('trigger'),
  appKey: z.string(),
  key: z.string(),
  description: z.string(),
}) satisfies z.ZodType<IFlowStepsTrigger>

const actionStepSchema = z.object({
  type: z.literal('action'),
  appKey: z.string(),
  key: z.string(),
  description: z.string(),
  config: z.object({
    stepName: z.string(),
    templateConfig: z.record(z.string(), z.string()).optional(),
  }),
  parameters: z
    .object({
      depth: z.literal(0),
      branchName: z.string(),
    })
    .optional(),
}) satisfies z.ZodType<IFlowStepsAction>

export const flowStepsSchema = z.object({
  name: z.string(),
  trigger: triggerStepSchema,
  actions: z.array(actionStepSchema),
  traceId: z.string().optional(),
}) satisfies z.ZodType<IFlowSteps>

export type FlowSteps = z.infer<typeof flowStepsSchema>
