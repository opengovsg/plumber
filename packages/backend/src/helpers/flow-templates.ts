import { TEMPLATES } from '@/db/storage'
import type {
  FlowConfig,
  TemplateStep,
} from '@/graphql/__generated__/types.generated'
import Flow from '@/models/flow'
import User from '@/models/user'

import logger from './logger'

export async function createFlowFromTemplate(
  templateId: string,
  user: User,
  isAutoCreated: boolean,
): Promise<Flow> {
  const template = TEMPLATES.find((template) => template.id === templateId)
  // prevents user from creating any new template
  if (!template) {
    throw new Error('Invalid template id input')
  }

  // check if the template is a demo template first: affects name, config and logging only
  const { name: flowName, steps, tag } = template
  const isDemoTemplate = tag === 'demo'
  const flowConfig: FlowConfig = isDemoTemplate
    ? {
        demoConfig: {
          hasLoadedOnce: false,
          isAutoCreated,
          videoId: templateId, // template id is the same as demo video id for backwards compatibility
        },
      }
    : {
        templateConfig: {
          templateId,
        },
      }

  // transaction will insert flow and steps
  return await Flow.transaction(async (trx) => {
    // insert flow with template id in the demo or template config
    const flow = await user.$relatedQuery('flows', trx).insert({
      name: isDemoTemplate ? `[DEMO] ${flowName}` : flowName,
      config: flowConfig,
    })

    // insert trigger step
    await flow.$relatedQuery('steps', trx).insert({
      type: 'trigger',
      position: 1,
      appKey: steps[0].appKey,
      key: steps[0].eventKey,
      parameters: steps[0].parameters ?? {},
    })

    // action step could have app or event key to be null due to if-then
    // insert action steps based on steps
    for (let i = 1; i < steps.length; i++) {
      const step: TemplateStep = steps[i]
      await flow.$relatedQuery('steps', trx).insert({
        type: 'action',
        position: step.position,
        appKey: step.appKey,
        key: step.eventKey,
        parameters: step.parameters ?? {},
      })
    }

    logger.info('Flow created from template', {
      event: 'templated-flow-request',
      flowId: flow.id,
      flowName: flow.name,
      templateId,
      isDemoTemplate,
      isAutoCreated,
    })

    return flow
  })
}
