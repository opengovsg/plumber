import { raw } from 'objection'
import { z } from 'zod'

import { BadUserInputError } from '@/errors/graphql-errors'
import Step from '@/models/step'
import { lookupStepDefinition } from '@/services/step-definition'

import type { MutationResolvers } from '../__generated__/types.generated'

// Matches the step name input's maxLength in the editor.
export const MAX_STEP_NAME_LENGTH = 64

export const renameStepSchema = z.object({
  id: z.string().uuid(),
  flow: z.object({
    id: z.string().uuid(),
    // Epoch milliseconds, which assertNotUpdatedSince expects.
    updatedAt: z.string().regex(/^\d+$/),
  }),
  // An empty name falls back to the step's default name.
  stepName: z.string().trim().max(MAX_STEP_NAME_LENGTH),
})

const renameStep: NonNullable<MutationResolvers['renameStep']> = async (
  _parent,
  params,
  context,
) => {
  const parsed = renameStepSchema.safeParse(params.input)
  if (!parsed.success) {
    throw new BadUserInputError(
      `Invalid input: ${parsed.error.issues[0].path.join('.')}`,
    )
  }
  const {
    id,
    flow: { id: flowId, updatedAt: flowUpdatedAt },
    stepName,
  } = parsed.data

  return await Step.transaction(async (trx) => {
    const step = await context.currentUser
      .withAccessibleSteps({ requiredRole: 'editor', trx })
      .findOne({
        'steps.id': id,
        'steps.flow_id': flowId,
      })

    if (!step) {
      throw new BadUserInputError('Step not found')
    }

    step.flow.assertNotUpdatedSince(flowUpdatedAt, context.currentUser.id)

    // FormSG workflow steps take their names from the form.
    const isSystemStep =
      step.appKey && step.key
        ? lookupStepDefinition(step.appKey, step.key, step.type).kind ===
          'hidden'
        : false
    if (isSystemStep || (step.appKey === 'formsg' && step.parameters?.mrf)) {
      throw new BadUserInputError('This step name cannot be changed')
    }

    // Renames are allowed on published pipes, which the before-update hook blocks.
    // IMPORTANT: patch only stepName against the current row, so a concurrent
    // write to other config keys (e.g. endStepId) is never overwritten.
    const renamedStep = await Step.query(trx)
      .context({ shouldBypassBeforeUpdateHook: true })
      .patchAndFetchById(id, {
        updatedBy: context.currentUser.id,
        config: raw(
          `jsonb_set(coalesce(config, '{}'::jsonb), '{stepName}', to_jsonb(?::text))`,
          [stepName],
        ),
      })
      .withGraphFetched({ connection: true, flow: true })

    const updatedFlow = await step.flow.patchLastUpdated({
      flowId: step.flowId,
      updatedBy: context.currentUser.id,
      trx,
    })

    // Keeps the Model instance instead of spreading it.
    renamedStep.flow.updatedAt = updatedFlow.updatedAt
    renamedStep.flow.updatedBy = context.currentUser.id
    return renamedStep
  })
}

export default renameStep
