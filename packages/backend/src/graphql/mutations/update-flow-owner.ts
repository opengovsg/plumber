import Flow from '@/models/flow'
import Step from '@/models/step'
import Context from '@/types/express/context'

type Params = {
  input: {
    id: string
  }
}

const updateFlowOwner = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const { id } = params.input
  // new owner has no access to the current flow
  const flow = await Flow.query()
    .findOne({
      id,
    })
    .withGraphFetched({
      steps: {
        connection: true,
      },
    })
    .throwIfNotFound('Pipe to be transferred cannot be found')

  // place both updates in a transaction to ensure everything succeeds
  return await Flow.transaction(async (trx) => {
    // phase 1: nullify all the connections in the flow
    const nullifyConnections = flow.steps.map((step) =>
      Step.query(trx).findById(step.id).patch({
        connectionId: null,
        connection: null,
      }),
    )
    await Promise.all(nullifyConnections)

    // update to new owner id
    return await flow.$query(trx).patchAndFetch({
      userId: context.currentUser.id,
    })
  })
}

export default updateFlowOwner
