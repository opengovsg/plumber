import {
  REMOVE_AFTER_7_DAYS_OR_50_JOBS,
  REMOVE_AFTER_30_DAYS,
} from '@/helpers/default-job-configuration'
import globalVariable from '@/helpers/global-variable'
import flowQueue from '@/queues/flow'
import Context from '@/types/express/context'

type Params = {
  input: {
    id: string
    active: boolean
  }
}

const JOB_NAME = 'flow'
const EVERY_15_MINUTES_CRON = '*/15 * * * *'

const updateFlowStatus = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  let flow = await context.currentUser
    .$relatedQuery('flows')
    .findOne({
      id: params.input.id,
    })
    .throwIfNotFound()

  if (flow.active === params.input.active) {
    return flow
  }

  flow = await flow.$query().withGraphFetched('steps').patchAndFetch({
    active: params.input.active,
  })

  const triggerStep = await flow.getTriggerStep()
  const trigger = await triggerStep.getTriggerCommand()
  const interval = trigger.getInterval?.(triggerStep.parameters)
  const repeatOptions = {
    pattern: interval || EVERY_15_MINUTES_CRON,
  }

  if (trigger.type === 'webhook') {
    const $ = await globalVariable({
      flow,
      connection: await triggerStep.$relatedQuery('connection'),
      app: await triggerStep.getApp(),
      step: triggerStep,
      testRun: false,
    })

    if (flow.active && trigger.registerHook) {
      await trigger.registerHook($)
    } else if (!flow.active && trigger.unregisterHook) {
      await trigger.unregisterHook($)
    }
  } else {
    if (flow.active) {
      flow = await flow.$query().patchAndFetch({
        published_at: new Date().toISOString(),
      })

      const jobName = `${JOB_NAME}-${flow.id}`

      await flowQueue.add(
        jobName,
        { flowId: flow.id },
        {
          repeat: repeatOptions,
          jobId: flow.id,
          removeOnComplete: REMOVE_AFTER_7_DAYS_OR_50_JOBS,
          removeOnFail: REMOVE_AFTER_30_DAYS,
        },
      )
    } else {
      const repeatableJobs = await flowQueue.getRepeatableJobs()
      const job = repeatableJobs.find((job) => job.id === flow.id)

      await flowQueue.removeRepeatableByKey(job.key)
    }
  }

  return flow
}

export default updateFlowStatus
