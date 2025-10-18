import { randomUUID } from 'crypto'

import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import Step from '@/models/step'
import User from '@/models/user'
import Context from '@/types/express/context'

export async function generateMockFlow(
  context: Context,
  id: string,
  config?: Record<string, any>,
) {
  await Flow.query().insert({
    id,
    name: 'Test Flow',
    userId: context.currentUser.id,
    config: config ?? {},
  })
}

export async function generateMockStep(
  context: Context,
  key:
    | 'delayFor'
    | 'everyHour'
    | 'getCellValues'
    | 'NULL'
    | 'findMessage'
    | 'ifThen'
    | 'everyDay'
    | 'getTableRow'
    | 'createTableRow'
    | 'sendTransactionalEmail'
    | 'onlyContinueIf'
    | 'createTileRow'
    | 'dateTime'
    | 'httpRequest'
    | 'everyMonth'
    | 'createLetter'
    | 'updateSingleRow'
    | 'catchRawWebhook'
    | 'newSubmission'
    | 'findSingleRow'
    | 'performCalculation',
  appKey:
    | null
    | 'slack'
    | 'm365-excel'
    | 'custom-api'
    | 'webhook'
    | 'delay'
    | 'lettersg'
    | 'formatter'
    | 'tiles'
    | 'scheduler'
    | 'postman'
    | 'formsg'
    | 'calculator'
    | 'toolbox',
  type: 'action' | 'trigger',
  flowId: string,
  position: number,
  parameters?: Record<string, any>,
  config?: Record<string, any>,
) {
  return await Step.query().insert({
    key,
    appKey,
    type,
    flowId,
    position,
    parameters: parameters ?? {},
    config: config ?? {},
  })
}

export const generateMockUser = async (
  type: 'owner' | 'editor' | 'viewer' | 'nonCollaborator',
): Promise<User> => {
  return await User.query().insert({
    id: randomUUID(),
    email: `${type}@plumber.gov.sg`,
  })
}

export const generateMockCollaborator = async (
  flowId: string,
  userId: string,
  updatedBy: string,
  type: 'editor' | 'viewer',
): Promise<FlowCollaborator> => {
  return await FlowCollaborator.query().insert({
    flowId,
    userId,
    role: type,
    updatedBy,
  })
}
