import type { IJSONObject } from '@plumber/types'
import { z } from 'zod'

import { convertFlowToTemplate } from '@/helpers/convert-flow-to-template'
import logger from '@/helpers/logger'
import { omitCopiedStepConfig } from '@/helpers/omit-copied-step-config'
import { sanitizeCollaboratorDuplicatedParameters } from '@/helpers/sanitize-collaborator-duplicated-step'
import {
  type SourceTile,
  templatizeTilesSteps,
} from '@/helpers/templatize-tiles-steps'
import TableMetadata from '@/models/table-metadata'
import Template from '@/models/template'

import type { MutationResolvers } from '../__generated__/types.generated'

const metadataSchema = z.object({
  name: z.string().trim().min(1).max(255).nullish(),
  description: z.string().trim().max(2000).nullish(),
})

async function fetchSourceTiles(
  steps: { appKey?: string | null; parameters: IJSONObject }[],
): Promise<SourceTile[]> {
  const tileIds = new Set(
    steps
      .filter((step) => step.appKey === 'tiles')
      .map((step) => step.parameters?.tableId)
      // Postgres rejects non-uuid values for uuid columns.
      .filter((id): id is string => z.string().uuid().safeParse(id).success),
  )
  if (tileIds.size === 0) {
    return []
  }
  // Not scoped to the user: collaborators also get the tile's column names.
  return TableMetadata.query()
    .findByIds([...tileIds])
    .withGraphFetched({ columns: true })
}

const createTemplateFromFlow: MutationResolvers['createTemplateFromFlow'] =
  async (_parent, params, context) => {
    const metadata = metadataSchema.parse(params.input)
    const flow = await context.currentUser
      .withAccessibleFlows({ requiredRole: 'viewer' })
      .withGraphFetched({ steps: true })
      .findOne({ 'flows.id': params.input.flowId })
      .throwIfNotFound()

    // Editors and Viewers must not keep the owner's files, tables or secrets.
    const isOwner = flow.role === 'owner'
    const sourceTiles = await fetchSourceTiles(flow.steps)
    const sourceSteps = templatizeTilesSteps(flow.steps, sourceTiles).map(
      (step) => ({
        ...step,
        config: step.config && omitCopiedStepConfig(step.config),
        parameters:
          isOwner || step.appKey === 'tiles'
            ? step.parameters
            : sanitizeCollaboratorDuplicatedParameters(
                step.appKey,
                step.parameters,
              ),
      }),
    )

    return await Template.transaction(async (trx) => {
      const template = await context.currentUser
        .$relatedQuery('templates', trx)
        .insert({
          name: metadata.name ?? flow.name,
          description: metadata.description ?? '',
        })

      const { steps } = convertFlowToTemplate(
        { name: flow.name, steps: sourceSteps },
        {
          id: template.id,
          description: template.description,
        },
      )

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
