import {
  generateMockFlow,
  generateMockStep,
} from '@/graphql/__tests__/mutations/flow.mock'
import { generateMockContext } from '@/graphql/__tests__/mutations/tiles/table.mock'
import Step from '@/models/step'
import type Context from '@/types/express/context'

export { generateMockContext, generateMockFlow, generateMockStep }

interface CreateMrfTriggerStepOptions {
  context: Context
  flowId: string
  parameters?: Record<string, unknown>
}

export async function createMrfTriggerStep(
  options: CreateMrfTriggerStepOptions,
): Promise<Step> {
  const {
    context,
    flowId,
    parameters = {
      mrf: {
        defaultStepName: 'Step 1',
        formWorkflowStepId: 'trigger-001',
        type: 'static',
        fields: ['field1'],
      },
    },
  } = options

  return generateMockStep(
    context,
    'newSubmission',
    'formsg',
    'trigger',
    flowId,
    1,
    parameters,
  )
}

interface CreateMrfActionStepOptions {
  context: Context
  flowId: string
  position: number
  formWorkflowStepId?: string
  fields?: string[]
  approvalField?: string
  defaultStepName?: string
  type?: string
  extraParameters?: Record<string, unknown>
}

export async function createMrfActionStep(
  options: CreateMrfActionStepOptions,
): Promise<Step> {
  const {
    context,
    flowId,
    position,
    formWorkflowStepId = `action-${String(position).padStart(3, '0')}`,
    fields = ['field1'],
    approvalField,
    defaultStepName = `Step ${position}`,
    type = 'static',
    extraParameters = {},
  } = options

  return generateMockStep(
    context,
    'mrfSubmission',
    'formsg',
    'action',
    flowId,
    position,
    {
      mrf: {
        defaultStepName,
        formWorkflowStepId,
        type,
        fields,
        ...(approvalField !== undefined ? { approvalField } : {}),
      },
      ...extraParameters,
    },
  )
}

interface CreateRejectBranchStepOptions {
  context: Context
  flowId: string
  position: number
  linkedStepId: string
}

export async function createRejectBranchStep(
  options: CreateRejectBranchStepOptions,
): Promise<Step> {
  const { context, flowId, position, linkedStepId } = options

  return generateMockStep(
    context,
    'sendTransactionalEmail',
    'postman',
    'action',
    flowId,
    position,
    {},
    { approval: { branch: 'reject', stepId: linkedStepId } },
  )
}

interface CreateNormalActionStepOptions {
  context: Context
  flowId: string
  position: number
}

export async function createNormalActionStep(
  options: CreateNormalActionStepOptions,
): Promise<Step> {
  const { context, flowId, position } = options

  return generateMockStep(
    context,
    'sendTransactionalEmail',
    'postman',
    'action',
    flowId,
    position,
  )
}
