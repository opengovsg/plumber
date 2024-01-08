import {
  IActionItem,
  IApp,
  IGlobalVariable,
  IJSONObject,
  IRequest,
  ITriggerItem,
} from '@plumber/types'

import appConfig from '@/config/app'
import EarlyExitError from '@/errors/early-exit'
import Connection from '@/models/connection'
import Execution from '@/models/execution'
import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'

import createHttpClient from './http-client'

type GlobalVariableOptions = {
  connection?: Connection
  app: IApp
  flow?: Flow
  step?: Step
  execution?: Execution
  testRun?: boolean
  request?: IRequest
  user?: User // only required in GraphQL context
}

const globalVariable = async (
  options: GlobalVariableOptions,
): Promise<IGlobalVariable> => {
  const {
    connection,
    app,
    flow,
    step,
    execution,
    request,
    testRun = false,
    user,
  } = options

  const isTrigger = step?.isTrigger
  const nextStep = await step?.getNextStep()

  const $: IGlobalVariable = {
    auth: {
      set: async (args: IJSONObject) => {
        if (connection) {
          await connection.$query().patchAndFetch({
            formattedData: {
              ...connection.formattedData,
              ...args,
            },
          })

          $.auth.data = connection.formattedData
        }

        return null
      },
      data: connection?.formattedData,
    },
    app: app,
    flow: {
      id: flow?.id,
      hasFileProcessingActions:
        (await flow?.containsFileProcessingActions()) ?? false,
    },
    step: {
      id: step?.id,
      appKey: step?.appKey,
      position: step?.position,
      parameters: step?.parameters || {},
    },
    nextStep: {
      id: nextStep?.id,
      appKey: nextStep?.appKey,
      parameters: nextStep?.parameters || {},
    },
    execution: {
      id: execution?.id,
      testRun,
    },
    getLastExecutionStep: async () =>
      (await step?.getLastExecutionStep())?.toJSON(),
    triggerOutput: {
      data: [],
    },
    actionOutput: {
      data: {
        raw: null,
      },
    },
    pushTriggerItem: async (triggerItem: ITriggerItem) => {
      if (await isAlreadyProcessed(triggerItem.meta.internalId)) {
        // early exit as we do not want to process duplicate items in actual executions
        throw new EarlyExitError()
      }

      $.triggerOutput.data.push(triggerItem)

      if ($.execution.testRun) {
        // early exit after receiving one item as it is enough for test execution
        throw new EarlyExitError()
      }
    },
    setActionItem: (actionItem: IActionItem) => {
      $.actionOutput.data = actionItem
    },
    user,
  }

  if (request) {
    $.request = request
  }

  $.http = createHttpClient({
    $,
    baseURL: app.apiBaseUrl,
    beforeRequest: app.beforeRequest ?? [],
    requestErrorHandler: app.requestErrorHandler ?? null,
  })

  if (flow) {
    const webhookUrl = appConfig.webhookUrl + '/webhooks/' + flow.id

    $.webhookUrl = webhookUrl
  }

  if (isTrigger && (await step.getTriggerCommand()).type === 'webhook') {
    $.flow.setRemoteWebhookId = async (remoteWebhookId) => {
      await flow.$query().patchAndFetch({
        remoteWebhookId,
      })

      $.flow.remoteWebhookId = remoteWebhookId
    }

    $.flow.remoteWebhookId = flow.remoteWebhookId
  }

  // Fetch and cache last internal ids for isAlreadyProcessed
  let lastInternalIds: string[] | undefined

  const isAlreadyProcessed = async (internalId: string): Promise<boolean> => {
    if (testRun || (flow && step.isAction)) {
      return false
    }
    if (!lastInternalIds) {
      lastInternalIds = await flow?.lastInternalIds(500)
    }
    return lastInternalIds?.includes(internalId)
  }

  return $
}

export default globalVariable
