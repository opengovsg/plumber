import Flow from '@/models/flow'
import Step from '@/models/step'
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
