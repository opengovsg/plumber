import { z } from 'zod'

export const ExecutionRowSchema = z.object({
  id: z.string(),
  flowId: z.string(),
  status: z.enum(['success', 'failure']).nullable(),
  testRun: z.boolean(),
  internalId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
})

export const ExecutionStepRowSchema = z.object({
  id: z.string(),
  executionId: z.string(),
  stepId: z.string(),
  appKey: z.string().nullable(),
  key: z.string().nullable(),
  jobId: z.string().nullable(),
  status: z.enum(['success', 'failure']).nullable(),
  dataIn: z.record(z.string(), z.unknown()).nullable(),
  dataOut: z.record(z.string(), z.unknown()).nullable(),
  errorDetails: z.record(z.string(), z.unknown()).nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
})

export const ArchivedPayloadSchema = z.object({
  execution: ExecutionRowSchema,
  steps: z.array(ExecutionStepRowSchema),
})

export type ExecutionRow = z.infer<typeof ExecutionRowSchema>
export type ExecutionStepRow = z.infer<typeof ExecutionStepRowSchema>
export type ArchivedPayload = z.infer<typeof ArchivedPayloadSchema>
