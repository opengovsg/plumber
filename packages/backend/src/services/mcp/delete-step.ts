import { raw, type Transaction } from 'objection'

import { removeMrfSteps } from '@/apps/formsg/triggers/new-submission/remove-mrf-steps'
import {
  repairEndStepsOnDeleteStep,
  upgradeIfThenV1BlocksIfEnabled,
} from '@/apps/toolbox/common/validate-end-step'
import { hasStepReference } from '@/helpers/check-step-parameters'
import Flow from '@/models/flow'
import Step from '@/models/step'
import type User from '@/models/user'

import { PublishedPipeError } from './published-pipe-error'
import { stampStepDeletedByAi } from './step-ai-builder-config'

export interface DeleteStepInput {
  user: User
  pipeId: string
  stepId: string
  traceId?: string
}

export async function deleteStepService({
  user,
  pipeId,
  stepId,
  traceId,
}: DeleteStepInput): Promise<Flow> {
  return Step.transaction(async (trx) => {
    await trx.raw('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;')

    const step = await user
      .withAccessibleSteps({ requiredRole: 'editor', trx })
      .withGraphFetched('flow')
      .findOne({ 'steps.id': stepId, 'steps.flow_id': pipeId })

    if (!step) {
      throw new Error('Step not found')
    }

    const flow = step.flow

    if (flow.active) {
      throw new PublishedPipeError()
    }

    if (traceId) {
      await step.$query(trx).patch({
        config: stampStepDeletedByAi(step.config, traceId),
      })
    }

    // Same reason as create_step: a legacy If block needs its marker before
    // the repair pass can shrink it. Excludes the step being deleted so an
    // If step removed here is not pinned first.
    await upgradeIfThenV1BlocksIfEnabled(
      trx,
      flow,
      await flow.$relatedQuery('steps', trx).orderBy('position', 'asc'),
      new Set([stepId]),
    )

    const stepsBeforeDelete = await flow
      .$relatedQuery('steps', trx)
      .orderBy('position', 'asc')

    if (step.type === 'trigger') {
      if (step.appKey === 'formsg' && step.key === 'newSubmission') {
        if (traceId) {
          await stampFormSgCascadeDeletes(flow.id, traceId, trx)
        }
        await removeMrfSteps(flow.id, trx)
      }

      const allSteps = await flow
        .$relatedQuery('steps', trx)
        .where('id', '!=', stepId)
        .orderBy('position', 'asc')

      const stepsToInvalidate = getStepsToInvalidate(
        allSteps,
        new Set([stepId]),
      )
      await Step.query(trx)
        .findByIds(stepsToInvalidate)
        .patch({ status: 'incomplete' })

      await step.$query(trx).delete()
      await flow.$relatedQuery('steps', trx).insert({
        key: null,
        appKey: null,
        type: 'trigger',
        position: 1,
        parameters: {},
        connectionId: null,
      })
    } else {
      const allSteps = await flow
        .$relatedQuery('steps', trx)
        .where('id', '!=', stepId)
        .orderBy('position', 'asc')

      const stepsToInvalidate = getStepsToInvalidate(
        allSteps,
        new Set([stepId]),
      )
      await Step.query(trx)
        .findByIds(stepsToInvalidate)
        .patch({ status: 'incomplete' })

      await Step.query(trx).findById(stepId).delete()

      await flow
        .$relatedQuery('steps', trx)
        .where('position', '>', step.position)
        .patch({ position: raw('position - 1') })
    }

    // Unlike the editor, this deletes only the requested step: removing an
    // If step leaves its inner steps in place as unconditional steps, and
    // removing a block's last inner step shrinks that block.
    await repairEndStepsOnDeleteStep({ trx, flow, stepsBeforeDelete })

    await flow.patchLastUpdated({
      flowId: flow.id,
      updatedBy: user.id,
      trx,
    })

    return flow
      .$query(trx)
      .withGraphJoined('steps')
      .orderBy('steps.position', 'asc')
  })
}

async function stampFormSgCascadeDeletes(
  flowId: string,
  traceId: string,
  trx: Transaction,
): Promise<void> {
  const cascadedSteps = await Step.query(trx)
    .where('flow_id', flowId)
    .where('type', 'action')
    .andWhere((builder) => {
      void builder
        .where('key', 'mrfSubmission')
        .orWhereRaw(`steps.config->'approval'->>'branch' = ?`, ['reject'])
    })

  await Promise.all(
    cascadedSteps.map((cascaded) =>
      cascaded.$query(trx).patch({
        config: stampStepDeletedByAi(cascaded.config, traceId),
      }),
    ),
  )
}

function getStepsToInvalidate(
  steps: Step[],
  deletedIds: Set<string>,
): string[] {
  const stepsToInvalidate = []
  for (const s of steps) {
    if (hasStepReference(s.parameters, deletedIds)) {
      stepsToInvalidate.push(s.id)
    }
  }
  return stepsToInvalidate
}
