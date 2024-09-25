import type { IApp } from '@plumber/types'

import apps from '@/apps'
import { TEMPLATES } from '@/db/storage'
import type {
  FlowConfig,
  TemplateStep,
} from '@/graphql/__generated__/types.generated'
import Flow from '@/models/flow'
import User from '@/models/user'

import logger from './logger'

function validateAppAndEventKey(step: TemplateStep, templateName: string) {
  let app: IApp
  const { position, appKey, eventKey } = step
  if (appKey) {
    app = apps[appKey]
    if (!app) {
      throw new Error(
        `Invalid app key for ${templateName} template at step ${position}`,
      )
    }
  }

  if (eventKey) {
    const event = app?.triggers
      ? app?.triggers.find((trigger) => trigger.key === eventKey)
      : app?.actions.find((action) => action.key === eventKey)
    if (!event) {
      throw new Error(
        `Invalid event key for ${templateName} template at step ${position}`,
      )
    }
  }
}

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

    validateAppAndEventKey(steps[0], flowName)
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
      validateAppAndEventKey(step, flowName)
      // replace all parameters with {{user_email}} to the current user email
      const updatedParameters = structuredClone(step?.parameters ?? {})
      for (const [key, value] of Object.entries(updatedParameters)) {
        // ignore objects e.g. conditions because nothing to replace inside for now
        if (typeof value === 'object') {
          continue
        }

        const substitutedValue = String(value).replaceAll(
          '{{user_email}}',
          user.email,
        )
        updatedParameters[key] = substitutedValue
      }

      await flow.$relatedQuery('steps', trx).insert({
        type: 'action',
        position: step.position,
        appKey: step.appKey,
        key: step.eventKey,
        parameters: updatedParameters,
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
