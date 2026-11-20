import type { TestRunStepMetadata } from '@plumber/types'

import EarlyExitError from '@/errors/early-exit'
import HttpError from '@/errors/http'
import globalVariable from '@/helpers/global-variable'
import Flow from '@/models/flow'
import type User from '@/models/user'

type ProcessFlowOptions = {
  flowId: string
  testRun?: boolean
  testRunMetadata?: TestRunStepMetadata
  loggedInUser?: User
}

// TODO(ian): change this function name, it's actually processing trigger
export const processFlow = async (options: ProcessFlowOptions) => {
  const flow = await Flow.query()
    .findById(options.flowId)
    .withGraphJoined('user')
    .throwIfNotFound()

  const triggerStep = await flow.getTriggerStep()
  const triggerCommand = await triggerStep.getTriggerCommand()
  if (!triggerCommand) {
    throw new Error(`Trigger command not found for step: ${triggerStep.id}`)
  }

  const app = await triggerStep.getApp()
  if (!app) {
    throw new Error(`App not found for step: ${triggerStep.id}`)
  }

  const $ = await globalVariable({
    flow,
    connection: await triggerStep.$relatedQuery('connection'),
    app,
    step: triggerStep,
    testRun: options.testRun,
    loggedInUser: options.loggedInUser,
  })

  // why not check if test run here?
  const shouldTestRun = triggerCommand.type === 'webhook' && !flow.active
  if (!(shouldTestRun ? triggerCommand.testRun : triggerCommand.run)) {
    throw new Error(
      `Trigger command has no ${
        shouldTestRun ? 'testRun' : 'run'
      }() for step: ${triggerStep.id}`,
    )
  }

  try {
    // IMPORTANT: Call through triggerCommand. Scheduler triggers read this.getInterval.
    await (shouldTestRun
      ? triggerCommand.testRun?.($, options.testRunMetadata)
      : triggerCommand.run?.($))
  } catch (error) {
    if (error instanceof EarlyExitError === false) {
      if (error instanceof HttpError) {
        $.triggerOutput.error = error.details
      } else {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        try {
          $.triggerOutput.error = JSON.parse(errorMessage)
        } catch {
          $.triggerOutput.error = { error: errorMessage }
        }
      }
    }
  }

  return $.triggerOutput
}
