import type { TestRunStepMetadata } from '@plumber/types'

import EarlyExitError from '@/errors/early-exit'
import HttpError from '@/errors/http'
import globalVariable from '@/helpers/global-variable'
import Flow from '@/models/flow'

type ProcessFlowOptions = {
  flowId: string
  testRun?: boolean
  testRunMetadata?: TestRunStepMetadata
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
  })

  // why not check if test run here?
  const shouldTestRun = triggerCommand.type === 'webhook' && !flow.active
  const runFn = shouldTestRun ? triggerCommand.testRun : triggerCommand.run
  if (!runFn) {
    throw new Error(
      `Trigger command has no ${
        shouldTestRun ? 'testRun' : 'run'
      }() for step: ${triggerStep.id}`,
    )
  }

  try {
    if (shouldTestRun) {
      await runFn($, options.testRunMetadata)
    } else {
      await runFn($)
    }
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
