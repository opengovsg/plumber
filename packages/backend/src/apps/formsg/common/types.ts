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

export interface FormSchema {
  form: {
    workflow?: z.infer<typeof mrfWorkflowDataSchema>
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
export interface ParsedMrfWorkflowStep {
  defaultStepName: string
  formWorkflowStepId: string
  type: 'static' | 'dynamic' | 'conditional'
  fields?: string[]
  approvalField?: string
}

export interface ParsedMrfWorkflow {
  trigger: Omit<ParsedMrfWorkflowStep, 'approvalField'>
  actions: ParsedMrfWorkflowStep[]
}
