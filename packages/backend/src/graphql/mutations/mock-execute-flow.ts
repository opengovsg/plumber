import globalVariable from '@/helpers/global-variable'
import Execution from '@/models/execution'
import Context from '@/types/express/context'

type Params = {
  input: {
    stepId: string
  }
}

const mockExecuteFlow = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const { stepId } = params.input
  const step = await context.currentUser
    .$relatedQuery('steps')
    .findById(stepId)
    .throwIfNotFound()
  const triggerCommand = await step.getTriggerCommand()
  if (!triggerCommand.mockRun) {
    throw new Error('Step doesnt have mockRun function')
  }
  const [app, flow, connection] = await Promise.all([
    step.getApp(),
    step.$relatedQuery('flow').throwIfNotFound(),
    step.$relatedQuery('connection').throwIfNotFound(),
  ])
  const $ = await globalVariable({
    step,
    app,
    flow,
    connection,
    user: context.currentUser,
  })
  const mockData = await triggerCommand.mockRun($)
  const execution = await Execution.query().insert({
    flowId: step.flowId,
    testRun: true,
  })
  const executionStep = await execution
    .$relatedQuery('executionSteps')
    .insertAndFetch({
      stepId: stepId,
      status: 'success',
      dataIn: step.parameters,
      dataOut: mockData,
      appKey: app.key,
    })
  step.executionSteps = [executionStep]
  return { data: executionStep.dataOut, step }
}

export default mockExecuteFlow
