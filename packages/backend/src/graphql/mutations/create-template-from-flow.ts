import { convertFlowToTemplate } from '@/helpers/convert-flow-to-template'
import { getStepVersion } from '@/helpers/get-step-version'
import logger from '@/helpers/logger'
import Template from '@/models/template'

import type { MutationResolvers } from '../__generated__/types.generated'

const createTemplateFromFlow: MutationResolvers['createTemplateFromFlow'] =
  async (_parent, params, context) => {
    const flow = await context.currentUser
      .withAccessibleFlows({ requiredRole: 'viewer' })
      .withGraphFetched({ steps: true })
      .findOne({ 'flows.id': params.input.flowId })
      .throwIfNotFound()

    return await Template.transaction(async (trx) => {
      const template = await context.currentUser
        .$relatedQuery('templates', trx)
        .insert({ name: flow.name, description: '' })

      const { steps } = convertFlowToTemplate(flow, {
        id: template.id,
        description: template.description,
      })

      for (const step of steps) {
        await template.$relatedQuery('steps', trx).insert({
          type: step.position === 1 ? 'trigger' : 'action',
          position: step.position,
          appKey: step.appKey,
          key: step.eventKey,
          parameters: step.parameters,
          version: getStepVersion(step.appKey, step.eventKey),
        })
      }

      logger.info('Template created from flow', {
        event: 'create-template-from-flow',
        flowId: flow.id,
        templateId: template.id,
      })

      return {
        id: template.id,
        name: template.name,
        description: template.description,
        steps,
      }
    })
  }

export default createTemplateFromFlow
