import { isIfThenStep } from '@/apps/toolbox/common/constants'
import { UserFacingError } from '@/errors/user-facing-error'
import Step from '@/models/step'
import type User from '@/models/user'

import type { McpStepInput } from './create-flow-with-steps'
import { assertStepCreatable, createStepInTransaction } from './create-step'

/** The pipe exists but no action was added, so the caller still needs its id. */
export class MrfPipeStepsError extends UserFacingError {
  constructor(message: string, public readonly flowId: string) {
    super(message)
    this.name = 'MrfPipeStepsError'
  }
}

/**
 * The pipe exists but its stage steps do not, and the model cannot make them.
 * The pipe is left as it is, since deleting it from here is not worth the risk.
 */
export class MrfStageStepsError extends UserFacingError {
  constructor(flowId: string) {
    super(
      `The pipe was created (id ${flowId}) but its stage steps could not be created. Do not use that pipe. Tell the user, then call create_pipe again to make a new one.`,
    )
    this.name = 'MrfStageStepsError'
  }
}

interface Tail {
  stepId: string
  isInsideBlock: boolean
}

const MAX_ATTEMPTS = 3
// Postgres serialization_failure, raised when a concurrent edit conflicts.
const SERIALIZATION_FAILURE = '40001'

/**
 * Adds a create_pipe request's actions to a pipe whose MRF stage steps
 * already exist, in one transaction so either every action lands or none do.
 * Each action goes through the same code as a create_step call. The stage
 * steps sit right after the trigger, which is why these actions can't be
 * inserted with the trigger.
 */
export async function addMrfActions({
  user,
  flowId,
  actions,
}: {
  user: User
  flowId: string
  actions: McpStepInput[]
}): Promise<void> {
  let current: McpStepInput | undefined

  try {
    for (const action of actions) {
      current = action
      await assertStepCreatable(action.appKey, action.key as string)
    }

    const flowSteps = await Step.query()
      .where('flow_id', flowId)
      .orderBy('position', 'asc')
    const stageSteps = flowSteps.filter(
      (step) => step.appKey === 'formsg' && step.key === 'mrfSubmission',
    )
    // Stage 1 is the trigger, so stage N is anchors[N - 1].
    const anchors = [flowSteps[0], ...stageSteps]
    // The steps inside an If block carry no stage of their own.
    const hasMissingStage = actions.some(
      (action) =>
        action.mrfStage !== undefined && !anchors[action.mrfStage - 1],
    )
    if (hasMissingStage) {
      throw new MrfStageStepsError(flowId)
    }

    for (let attempt = 1; ; attempt++) {
      try {
        await Step.transaction(async (trx) => {
          await trx.raw('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;')

          const tails = new Map<string, Tail>()
          let ifThenCount = 0

          for (let index = 0; index < actions.length; index++) {
            const action = actions[index]
            const stage = action.mrfStage as number
            const branch = action.mrfBranch ?? 'approve'
            const anchor = anchors[stage - 1]
            const approvalBranch =
              branch === 'reject'
                ? { branch: 'reject' as const, stepId: anchor.id }
                : undefined
            const blockSize = isIfThenStep(action)
              ? action.ifThenChildCount ?? 0
              : 0

            const groupKey = `${stage}:${branch}`
            let previous: Tail = tails.get(groupKey) ?? {
              stepId: anchor.id,
              isInsideBlock: false,
            }

            for (const [offset, member] of actions
              .slice(index, index + 1 + blockSize)
              .entries()) {
              current = member
              const created = await createStepInTransaction(trx, {
                user,
                pipeId: flowId,
                appKey: member.appKey,
                key: member.key as string,
                previousStepId: previous.stepId,
                // The first step after a block must land outside it.
                afterIfThenBlock: offset === 0 && previous.isInsideBlock,
                approvalBranch,
              })

              const parameters = {
                ...created.parameters,
                ...(isIfThenStep(member) && {
                  branchName: `Branch ${++ifThenCount}`,
                }),
                ...member.parameters,
              }
              await Step.query(trx)
                .patch({ parameters })
                .where('steps.id', created.id)

              previous = { stepId: created.id, isInsideBlock: blockSize > 0 }
            }

            tails.set(groupKey, previous)
            index += blockSize
          }
        })
        return
      } catch (error) {
        const isConflict =
          (error as { code?: string }).code === SERIALIZATION_FAILURE
        if (!isConflict || attempt >= MAX_ATTEMPTS) {
          throw error
        }
      }
    }
  } catch (error) {
    if (error instanceof MrfStageStepsError) {
      throw error
    }
    const reason = error instanceof Error ? error.message : String(error)
    throw new MrfPipeStepsError(
      `The pipe was created (id ${flowId}) with its stage steps, but no action was added. ${current?.appKey}/${current?.key} failed: ${reason} Call get_flow, then add the actions with create_step.`,
      flowId,
    )
  }
}
