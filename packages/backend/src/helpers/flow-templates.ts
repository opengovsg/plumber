import type { AppEventKeyPair } from '@plumber/types'

import type {
  CreateFlowTemplateInput,
  DemoVideoDetails,
  FlowConfig,
} from '@/graphql/__generated__/types.generated'
import Flow from '@/models/flow'
import User from '@/models/user'

import logger from './logger'

export const DEFAULT_FLOW_TEMPLATE: CreateFlowTemplateInput = {
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
  demoVideoDetails: {
    url: 'https://demo.arcade.software/FzpL1zCmibw0oXR6HUJi?embed&show_copy_link=true',
    title: 'Send notifications',
  },
}

async function makeFlowTemplate(
  flowName: string,
  trigger: AppEventKeyPair,
  actions: AppEventKeyPair[],
  user: User,
  isPreCreated: boolean,
  demoVideoDetails: DemoVideoDetails,
): Promise<Flow> {
  const { appKey: triggerAppKey, eventKey: triggerEventKey } = trigger

  // transaction will insert flow and steps
  return await Flow.transaction(async (trx) => {
    const flowConfig: FlowConfig = {
      demoConfig: {
        onFirstLoad: true,
        isPreCreated,
        videoDetails: demoVideoDetails,
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
      isPreCreated,
    })

    return flow
  })
}

export default makeFlowTemplate
