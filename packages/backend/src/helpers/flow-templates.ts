import type {
  CreateTemplatedFlowInput,
  FlowConfig,
} from '@/graphql/__generated__/types.generated'
import Flow from '@/models/flow'
import User from '@/models/user'

import logger from './logger'

export const DEFAULT_FLOW_TEMPLATE: CreateTemplatedFlowInput = {
  flowName: 'Send notifications',
  trigger: {
    appKey: 'formsg',
    eventKey: 'newSubmission',
  },
  actions: [
    {
      appKey: 'postman',
      eventKey: 'sendTransactionalEmail',
    },
  ],
  demoVideoId: 'formsg-postman',
}

export async function createDemoFlowFromTemplate(
  templatedFlowInput: CreateTemplatedFlowInput,
  user: User,
  isAutoCreated: boolean,
): Promise<Flow> {
  const { flowName, trigger, actions, demoVideoId } = templatedFlowInput
  const { appKey: triggerAppKey, eventKey: triggerEventKey } = trigger

  // transaction will insert flow and steps
  return await Flow.transaction(async (trx) => {
    const flowConfig: FlowConfig = {
      demoConfig: {
        hasLoadedOnce: false,
        isAutoCreated,
        videoId: demoVideoId,
      },
    }
    // insert flow
    const flow = await user.$relatedQuery('flows', trx).insert({
      name: `[DEMO] ${flowName}`,
      config: flowConfig,
    })

    // insert trigger step
    await flow.$relatedQuery('steps', trx).insert({
      type: 'trigger',
      position: 1,
      appKey: triggerAppKey,
      key: triggerEventKey,
    })

    // insert action steps
    for (let i = 0; i < actions.length; i++) {
      const { appKey: actionAppKey, eventKey: actionEventKey } = actions[i]
      await flow.$relatedQuery('steps', trx).insert({
        type: 'action',
        position: i + 2, // start at position 2
        appKey: actionAppKey,
        key: actionEventKey,
      })
    }

    logger.info('Demo flow created', {
      event: 'demo-flow-request',
      flowId: flow.id,
      flowName: flow.name,
      trigger,
      actions,
      isAutoCreated,
    })

    return flow
  })
}

export async function createFlowFromTemplate(
  templatedFlowInput: CreateTemplatedFlowInput,
  user: User,
): Promise<Flow> {
  const { flowName, trigger, actions, parametersList, templateId } =
    templatedFlowInput
  const { appKey: triggerAppKey, eventKey: triggerEventKey } = trigger

  // transaction will insert flow and steps
  return await Flow.transaction(async (trx) => {
    // insert flow with template id
    const flow = await user.$relatedQuery('flows', trx).insert({
      name: flowName,
      templateId,
    })

    // account for trigger/action step having null for app or event key
    // insert trigger step
    await flow.$relatedQuery('steps', trx).insert({
      type: 'trigger',
      position: 1,
      ...(triggerAppKey !== '' && {
        appKey: triggerAppKey,
      }),
      ...(triggerEventKey !== '' && {
        key: triggerEventKey,
      }),
      parameters: parametersList[0],
    })

    // insert action steps
    for (let i = 0; i < actions.length; i++) {
      const { appKey: actionAppKey, eventKey: actionEventKey } = actions[i]
      await flow.$relatedQuery('steps', trx).insert({
        type: 'action',
        position: i + 2, // start at position 2
        ...(actionAppKey !== '' && {
          appKey: actionAppKey,
        }),
        ...(actionEventKey !== '' && {
          key: actionEventKey,
        }),
        parameters: parametersList[i + 1], // start at 2nd index
      })
    }

    logger.info('Flow created from template', {
      event: 'templated-flow-request',
      flowId: flow.id,
      flowName: flow.name,
      trigger,
      actions,
      parametersList,
      templateId,
    })

    return flow
  })
}
