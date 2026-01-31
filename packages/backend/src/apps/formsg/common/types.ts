import { z } from 'zod'

export const mrfWorkflowDataSchema = z.array(
  z.object({
    _id: z.string(),
    edit: z.array(z.string()),
    step_name: z.string().optional(),
    approval_field: z.string().optional(),
    workflow_type: z.enum(['static', 'dynamic', 'conditional']),
  }),
)

type IMrfWorkflow = z.infer<typeof mrfWorkflowDataSchema>

export interface FormSchema {
  form: {
    workflow?: IMrfWorkflow
    publicKey: string
    responseMode: string
    _id: string
    title: string
    status: string
    form_fields: Array<Record<string, any>>
    authType: string
    isSubmitterIdCollectionEnabled: boolean
    payments_field?: {
      enabled: boolean
      products: Array<{
        _id: string
        name: string
        amount_cents: number
      }>
    }
  }
}

/**
 * This will be stored in the step's parameters and
 * not modifiable by the user
 */
export const parsedMrfWorkflowStepSchema = z.object({
  defaultStepName: z.string(),
  formWorkflowStepId: z.string(),
  type: z.enum(['static', 'dynamic', 'conditional']),
  fields: z.array(z.string()),
  approvalField: z.string().optional(),
})

export type ParsedMrfWorkflowStep = z.infer<typeof parsedMrfWorkflowStepSchema>

export interface ParsedMrfWorkflow {
  trigger: Omit<ParsedMrfWorkflowStep, 'approvalField'>
  actions: ParsedMrfWorkflowStep[]
}

export const stepApprovalConfigSchema = z.object({
  branch: z.literal('reject'),
  stepId: z.string().uuid(),
})

export const submittedStepsSchema = z.array(
  z.object({
    isApproval: z.boolean(),
    submittedAt: z.string(),
    nextStepRecipientEmails: z.array(z.string()).optional(),
    status: z.enum(['APPROVED', 'REJECTED']).optional(),
    stepNumber: z.number().optional(),
  }),
)

/*
 * type for workflowContent in formsg mrf payload
 */
export interface FormsgPayloadWorkflowContent {
  workflow: IMrfWorkflow
  workflowStep: number
  submittedSteps: z.infer<typeof submittedStepsSchema>
}
