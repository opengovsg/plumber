import { IRequest, ITriggerItem } from '@plumber/types'

import { Response } from 'express'

import { sha256Hash } from '../../helpers/crypto'
import { DEFAULT_JOB_OPTIONS } from '../../helpers/default-job-configuration'
import globalVariable from '../../helpers/global-variable'
import tracer from '../../helpers/tracer'
import Flow from '../../models/flow'
import actionQueue from '../../queues/action'
import { processTrigger } from '../../services/trigger'

export default async (request: IRequest, response: Response) => {
  const span = tracer.startSpan('webhooks.handler')

  const flow = await Flow.query()
    .findById(request.params.flowId)
    .throwIfNotFound()

  const testRun = !flow.active
  const triggerStep = await flow.getTriggerStep()
  const triggerCommand = await triggerStep.getTriggerCommand()
  const app = await triggerStep.getApp()
  const isWebhookApp =
    app.key === 'webhook' ||
    app.key === 'formsg' ||
    app.key === 'vault-workspace'

  // Allow all webhook test runs to work
  if (testRun && !isWebhookApp) {
    return response.sendStatus(404)
  }

  if (triggerCommand.type !== 'webhook') {
    return response.sendStatus(404)
  }

  if (app.auth?.verifyWebhook) {
    const $ = await globalVariable({
      flow,
      connection: await triggerStep.$relatedQuery('connection'),
      app,
      step: triggerStep,
      request,
    })

    const verified = await app.auth.verifyWebhook($)

    if (!verified) {
      return response.sendStatus(401)
    }
  }

  // in case trigger type is 'webhook'
  let payload = request.body
  let rawInternalId: string | Buffer = request.rawBody

  // in case it's our built-in generic webhook trigger
  if (isWebhookApp) {
    payload = {
      ...request.body,
    }

    rawInternalId = JSON.stringify(payload)
  }

  const triggerItem: ITriggerItem = {
    raw: payload,
    meta: {
      internalId: sha256Hash(rawInternalId),
    },
  }

  const { flowId, executionId } = await processTrigger({
    flowId: flow.id,
    stepId: triggerStep.id,
    triggerItem,
    testRun,
  })

  if (testRun) {
    return response.sendStatus(200)
  }

  const nextStep = await triggerStep.getNextStep()
  const jobName = `${executionId}-${nextStep.id}`

  const jobPayload = {
    flowId,
    executionId,
    stepId: nextStep.id,
  }

  span.addTags({
    flowId,
    executionId,
    stepId: triggerStep.id,
    appKey: app.key,
  })

  await actionQueue.add(jobName, jobPayload, DEFAULT_JOB_OPTIONS)

  span.finish()

  return response.sendStatus(200)
}
