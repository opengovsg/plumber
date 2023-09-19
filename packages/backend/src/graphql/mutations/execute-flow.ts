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

  const { executionStep, skippedIfPublished } = await testRun({ stepId })

  untilStep.executionSteps = [executionStep] // attach missing execution step into current step

  if (executionStep.isFailed) {
    throw new Error(JSON.stringify(executionStep.errorDetails))
  }

  if (executionStep.dataOut) {
    await untilStep.$query().patch({
      status: 'completed',
    })
  }

  return { data: executionStep.dataOut, step: untilStep, skippedIfPublished }
}

export default executeFlow
