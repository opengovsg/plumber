import { z } from 'zod'

/**
 * This determines the kind of routing for this step
 * Static: routes to a fixed list of emails
 * Dynamic: routes based on a a specified email field
 * Conditional: routes based on a dropdown field which corresponds to a list of emails
 */
const workflowTypeSpecificFields = z.discriminatedUnion('workflow_type', [
  z.object({
    workflow_type: z.literal('static'),
    emails: z.array(z.string()),
  }),
  z.object({
    workflow_type: z.literal('dynamic'),
    // the email field to use for routing
    field: z.string(),
  }),
  z.object({
    workflow_type: z.literal('conditional'),
    // the dropdown field to use for routing
    conditional_field: z.string(),
  }),
])

export const mrfWorkflowDataSchema = z.array(
  z
    .object({
      _id: z.string(),
      edit: z.array(z.string()),
      step_name: z.string().optional(),
      approval_field: z.string().optional(),
    })
    .and(workflowTypeSpecificFields),
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
