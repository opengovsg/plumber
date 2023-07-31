import testRun from '@/services/test-run'
import Context from '@/types/express/context'

type Params = {
  input: {
    stepId: string
  }
}

const executeFlow = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const { stepId } = params.input

  const untilStep = await context.currentUser
    .$relatedQuery('steps')
    .findById(stepId)
    .throwIfNotFound()

  const { executionStep } = await testRun({ stepId })

  console.log('execute flow')
  console.log(executionStep)
  console.log(untilStep)
  untilStep.executionSteps = [executionStep]

  if (executionStep.isFailed) {
    throw new Error(JSON.stringify(executionStep.errorDetails))
  }

  if (executionStep.dataOut) {
    await untilStep.$query().patch({
      status: 'completed',
    })
  }

  return { data: executionStep.dataOut, step: untilStep }
}

export default executeFlow
