import { z } from 'zod'

import { convertFlowToTemplate } from '@/helpers/convert-flow-to-template'
import logger from '@/helpers/logger'
import Template from '@/models/template'

import type { MutationResolvers } from '../__generated__/types.generated'

const metadataSchema = z.object({
  name: z.string().trim().min(1).max(255).nullish(),
  description: z.string().trim().max(2000).nullish(),
})

const createTemplateFromFlow: MutationResolvers['createTemplateFromFlow'] =
  async (_parent, params, context) => {
    const metadata = metadataSchema.parse(params.input)
    const flow = await context.currentUser
      .withAccessibleFlows({ requiredRole: 'viewer' })
      .withGraphFetched({ steps: true })
      .findOne({ 'flows.id': params.input.flowId })
      .throwIfNotFound()

    return await Template.transaction(async (trx) => {
      const template = await context.currentUser
        .$relatedQuery('templates', trx)
        .insert({
          name: metadata.name ?? flow.name,
          description: metadata.description ?? '',
        })

      const { steps } = convertFlowToTemplate(flow, {
        id: template.id,
        description: template.description,
      })

      if (steps.length > 0) {
        await template
          .$relatedQuery('templateSteps', trx)
          .insert(steps.map((step) => ({ data: step })))
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
