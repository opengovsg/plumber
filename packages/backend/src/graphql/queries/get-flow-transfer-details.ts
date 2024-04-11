import { ITransferDetails } from '@plumber/types'

import getDefaultTransferDetails, {
  getEmptyConnectionDetails,
} from '@/helpers/get-default-transfer-details'
import globalVariable from '@/helpers/global-variable'

import type { QueryResolvers } from '../__generated__/types.generated'

const getFlowTransferDetails: QueryResolvers['getFlowTransferDetails'] = async (
  _parent,
  params,
  context,
) => {
  const flowTransferDetails: ITransferDetails[] = []

  const flow = await context.currentUser
    .$relatedQuery('flows')
    .findById(params.flowId)
    .withGraphFetched({
      steps: {
        connection: true,
      },
    })
    .throwIfNotFound('Pipe not found')

  const getTransferDetailsPromises = flow.steps.map(async (step) => {
    const app = await step.getApp()
    // no app is selected or app has no auth and transfer details
    if (!app || (!app.auth && !app.getTransferDetails)) {
      return null
    }

    // extra check when formsg trigger is selected without the new submission event
    if (step.isTrigger && (await step.getTriggerCommand()) === null) {
      return getEmptyConnectionDetails(step.position, app.name)
    }

    const $ = await globalVariable({
      step,
      app,
      flow,
      connection: step.connection,
      user: context.currentUser,
    })

    // if app has auth and no transfer details, return default transfer details
    if (!app.getTransferDetails) {
      return getDefaultTransferDetails($)
    }

    return await app.getTransferDetails($)
  })

  const rawTransferDetails = await Promise.all(getTransferDetailsPromises) // contains either details or null

  // Map then forEach because pushing items into an array using just a forEach could be problematic in an async context
  rawTransferDetails.forEach((stepDetails) => {
    if (stepDetails !== null) {
      flowTransferDetails.push(stepDetails)
    }
  })

  return flowTransferDetails
}

export default getFlowTransferDetails
