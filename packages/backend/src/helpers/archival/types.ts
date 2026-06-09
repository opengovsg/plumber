export type ExecutionRow = {
  id: string
  flowId: string
  status: 'success' | 'failure' | null
  testRun: boolean
  internalId: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type ExecutionStepRow = {
  id: string
  executionId: string
  stepId: string
  appKey: string | null
  key: string | null
  jobId: string | null
  status: 'success' | 'failure' | null
  dataIn: Record<string, unknown> | null
  dataOut: Record<string, unknown> | null
  errorDetails: Record<string, unknown> | null
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}
