import { DEMO_TEMPLATES } from '@/db/storage/demo-templates-data'
import { TEMPLATES } from '@/db/storage/templates-data'
import type {
  FlowConfig,
  TemplateStep,
} from '@/graphql/__generated__/types.generated'
import Flow from '@/models/flow'
import User from '@/models/user'

import logger from './logger'

export async function createDemoFlowFromTemplate(
  templateId: string,
  user: User,
  isAutoCreated: boolean,
): Promise<Flow> {
  // note that template id is the same as demo video id for backwards compatibility
  // prevents user from creating any new template
  const demoTemplate = DEMO_TEMPLATES.find(
    (template) => template.id === templateId,
  )
  if (!demoTemplate) {
    throw new Error('Invalid demo template id input')
  }

  const { name: flowName, steps } = demoTemplate

  // transaction will insert flow and steps
  return await Flow.transaction(async (trx) => {
    const flowConfig: FlowConfig = {
      demoConfig: {
        hasLoadedOnce: false,
        isAutoCreated,
        videoId: templateId,
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
      appKey: steps[0].appKey,
      key: steps[0].eventKey,
    })

    // insert action steps
    for (let i = 1; i < steps.length; i++) {
      const step: TemplateStep = steps[i]
      await flow.$relatedQuery('steps', trx).insert({
        type: 'action',
        position: step.position,
        appKey: step.appKey,
        key: step.eventKey,
      })
    }

    logger.info('Demo flow created', {
      event: 'demo-flow-request',
      flowId: flow.id,
      flowName: flow.name,
      demoTemplateId: templateId,
      isAutoCreated,
    })

    return flow
  })
}

export async function createFlowFromTemplate(
  templateId: string,
  user: User,
): Promise<Flow> {
  // prevents user from creating any new template
  const template = TEMPLATES.find((template) => template.id === templateId)
  if (!template) {
    throw new Error('Invalid template id input')
  }

  const { name: flowName, steps } = template

  // transaction will insert flow and steps
  return await Flow.transaction(async (trx) => {
    // insert flow with template id in the template config
    const flow = await user.$relatedQuery('flows', trx).insert({
      name: flowName,
      config: {
        templateConfig: {
          templateId,
        },
      },
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
    })

    return flow
  })
}
