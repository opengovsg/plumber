import type { IJSONObject } from '@plumber/types'
import { z } from 'zod'

import { BadUserInputError, ForbiddenError } from '@/errors/graphql-errors'
import { convertFlowToTemplate } from '@/helpers/convert-flow-to-template'
import { validateTemplateTopology } from '@/helpers/flow-templates'
import logger from '@/helpers/logger'
import { omitCopiedStepConfig } from '@/helpers/omit-copied-step-config'
import { isPlumPro } from '@/helpers/plumpro'
import { sanitizeCollaboratorDuplicatedParameters } from '@/helpers/sanitize-collaborator-duplicated-step'
import { stripStepVariables } from '@/helpers/strip-step-variables'
import { templateSchema } from '@/helpers/template-schema'
import {
  type SourceTile,
  templatizeTilesSteps,
} from '@/helpers/templatize-tiles-steps'
import Template from '@/models/template'
import type User from '@/models/user'

import type { MutationResolvers } from '../__generated__/types.generated'

const metadataSchema = z.object({
  name: z.string().trim().min(1).max(255).nullish(),
  description: z.string().trim().max(2000).nullish(),
})

/**
 * IMPORTANT: scoped to the user's tiles. A step can still hold a tile the user
 * lost access to, or one saved through createStep without an access check.
 */
async function fetchSourceTiles(
  user: User,
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
  return user
    .$relatedQuery('tables')
    .findByIds([...tileIds])
    .withGraphFetched({ columns: true })
}

const createTemplateFromFlow: NonNullable<
  MutationResolvers['createTemplateFromFlow']
> = async (_parent, params, context) => {
  const isUserPlumPro = await isPlumPro(context.currentUser.email)

  // NOTE: For now, restrict only to power users. frontend doesn't show
  // the option but it is possible a user hits this via API (somehow)
  if (!isUserPlumPro) {
    throw new ForbiddenError('Only PlumPros can convert pipes to templates')
  }
  const metadata = metadataSchema.parse(params.input)
  const flow = await context.currentUser
    .withAccessibleFlows({ requiredRole: 'viewer' })
    .withGraphFetched({ steps: true })
    .findOne({ 'flows.id': params.input.flowId })
    .throwIfNotFound()

  // Templates are shared with every user, so only the owner may publish one.
  if (flow.role !== 'owner') {
    throw new ForbiddenError('Only the pipe owner can convert it to a template')
  }

  // Every user can see a community template, so it keeps no files, tables,
  // secrets or step variables.
  const sourceTiles = await fetchSourceTiles(context.currentUser, flow.steps)
  const sourceSteps = templatizeTilesSteps(flow.steps, sourceTiles).map(
    (step) => ({
      ...step,
      config: step.config && omitCopiedStepConfig(step.config),
      parameters: stripStepVariables(
        // Tiles IDs are already template placeholders.
        step.appKey === 'tiles'
          ? step.parameters
          : sanitizeCollaboratorDuplicatedParameters(
              step.appKey,
              step.parameters,
            ),
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
    // Reject here so the user never saves a template that fails on every use.
    try {
      templateSchema.parse({
        id: template.id,
        name: template.name,
        description: template.description,
        steps,
      })
      validateTemplateTopology(steps, template.id)
    } catch (error) {
      logger.warn('Pipe cannot be saved as a template', {
        event: 'create-template-from-flow-invalid',
        flowId: flow.id,
        error,
      })
      throw new BadUserInputError(
        'This pipe has invalid steps or blocks, so it cannot be saved as a template.',
      )
    }

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
