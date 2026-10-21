import { raw, type Transaction } from 'objection'

import { removeMrfSteps } from '@/apps/formsg/triggers/new-submission/remove-mrf-steps'
import {
  deriveIfThenV1EndStep,
  expandIfThenBlockDeletions,
} from '@/apps/toolbox/actions/if-then/infra/end-step-utils'
import { isIfThenStep, isIfThenV2 } from '@/apps/toolbox/common/constants'
import {
  repairEndStepsOnDeleteStep,
  upgradeIfThenV1BlocksIfEnabled,
} from '@/apps/toolbox/common/validate-end-step'
import { hasStepReference } from '@/helpers/check-step-parameters'
import logger from '@/helpers/logger'
import type Flow from '@/models/flow'
import Step from '@/models/step'

import { stampStepDeletedByAi } from './mcp/step-ai-builder-config'

export async function deleteStepsInTransaction({
  trx,
  flow,
  stepIds,
  traceId,
  includeLegacyIfBlockMembers = false,
}: {
  trx: Transaction
  flow: Flow
  stepIds: string[]
  traceId?: string
  includeLegacyIfBlockMembers?: boolean
}): Promise<void> {
  // Pin other legacy If blocks so the repair pass can shrink them. The
  // deleted If keeps its derived extent, resolved in stepsRemovedWith.
  await upgradeIfThenV1BlocksIfEnabled(
    trx,
    flow,
    await flow.$relatedQuery('steps', trx).orderBy('position', 'asc'),
    new Set(stepIds),
  )

  const stepsBeforeDelete = await flow
    .$relatedQuery('steps', trx)
    .orderBy('position', 'asc')

  const stepsToDelete = stepsRemovedWith(
    stepsBeforeDelete,
    stepIds,
    flow.id,
    includeLegacyIfBlockMembers,
  )

  if (traceId) {
    await Promise.all(
      stepsToDelete.map((member) =>
        member.$query(trx).patch({
          config: stampStepDeletedByAi(member.config, traceId),
        }),
      ),
    )
  }

  if (stepsToDelete.length === 0) {
    throw new Error('Nothing to delete')
  }

  const step = stepsToDelete[0]
  if (stepsToDelete.length === 1 && step.type === 'trigger') {
    if (step.appKey === 'formsg' && step.key === 'newSubmission') {
      if (traceId) {
        await stampFormSgCascadeDeletes(flow.id, traceId, trx)
      }
      await removeMrfSteps(flow.id, trx)
    }

    const allSteps = await flow
      .$relatedQuery('steps', trx)
      .where('id', '!=', step.id)
      .orderBy('position', 'asc')

    const stepsToInvalidate = getStepsToInvalidate(allSteps, new Set(stepIds))
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
    if (
      !stepsToDelete.every(
        (stepToDelete, index) =>
          (index === 0 ||
            stepToDelete.position === stepsToDelete[index - 1].position + 1) &&
          stepToDelete.type === 'action',
      )
    ) {
      throw new Error('Must delete contiguous action steps!')
    }

    const stepIds = stepsToDelete.map((stepToDelete) => stepToDelete.id)
    const allSteps = await flow
      .$relatedQuery('steps', trx)
      .whereNotIn('id', stepIds)
      .orderBy('position', 'asc')

    const stepsToInvalidate = getStepsToInvalidate(allSteps, new Set(stepIds))
    await Step.query(trx)
      .findByIds(stepsToInvalidate)
      .patch({ status: 'incomplete' })

    await Step.query(trx).findByIds(stepIds).delete()

    await flow
      .$relatedQuery('steps', trx)
      .where('position', '>', stepsToDelete[stepsToDelete.length - 1].position)
      .patch({ position: raw(`position - ${stepsToDelete.length}`) })
  }

  await repairEndStepsOnDeleteStep({ trx, flow, stepsBeforeDelete })
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

/**
 * Deleting an If step removes its whole block, matching the editor. A legacy
 * If has no marker, so its derived extent is used.
 */
function stepsRemovedWith(
  steps: Step[],
  stepIds: string[],
  flowId: string,
  includeLegacyIfBlockMembers: boolean,
): Step[] {
  const { expandedIds, danglingIfThenIds } = expandIfThenBlockDeletions(
    steps,
    stepIds,
  )
  for (const ifThenStepId of danglingIfThenIds) {
    logger.error({
      event: 'if-then-dangling-end-step',
      mutation: 'deleteStep',
      ifThenStepId,
      flowId,
    })
  }

  // The editor sends legacy block members explicitly. MCP supplies only the If step.
  for (const target of steps.filter(
    (step) => includeLegacyIfBlockMembers && stepIds.includes(step.id),
  )) {
    // A dangling marker is not a block. The editor falls back to the derived
    // extent and deletes those steps. Do the same.
    if (
      isIfThenStep(target) &&
      (!isIfThenV2(target) || danglingIfThenIds.includes(target.id))
    ) {
      const endStep = deriveIfThenV1EndStep(steps, target)
      for (const member of steps) {
        if (
          member.position >= target.position &&
          member.position <= endStep.position
        ) {
          expandedIds.add(member.id)
        }
      }
    }
  }

  return steps.filter((candidate) => expandedIds.has(candidate.id))
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
