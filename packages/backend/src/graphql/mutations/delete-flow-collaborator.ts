import { BadUserInputError } from '@/errors/graphql-errors'
import { validateAndParseEmail } from '@/helpers/email-validator'
import type { FlowCollaboratorSource } from '@/helpers/flow-events'
import logger from '@/helpers/logger'
import FlowCollaborator from '@/models/flow-collaborators'
import User from '@/models/user'
import { captureCollaboratorChange } from '@/services/flow/flow-collaborator-event'

import { MutationResolvers } from '../__generated__/types.generated'

function captureRemoval(
  removed: FlowCollaborator[],
  actorUserId: string,
  flowId: string,
  source: FlowCollaboratorSource,
): void {
  for (const collaborator of removed) {
    captureCollaboratorChange({
      actorUserId,
      flowId,
      collaboratorUserId: collaborator.userId,
      change: { type: 'removed', previousRole: collaborator.role },
      source,
    })
  }
}

const deleteFlowCollaborator: NonNullable<
  MutationResolvers['deleteFlowCollaborator']
> = async (_parent, params, context) => {
  const { flowId, email } = params.input as {
    flowId: string
    email: string
  }

  const validatedEmail = await validateAndParseEmail(email)
  if (!validatedEmail) {
    throw new BadUserInputError('Invalid collaborator email')
  }

  const isSelf = validatedEmail === context.currentUser.email

  if (isSelf) {
    // Scope to accessible flows so missing and inaccessible IDs share one error.
    const flow = await context.currentUser
      .withAccessibleFlows({ requiredRole: 'viewer' })
      .findById(flowId)
      .throwIfNotFound()

    if (flow.role === 'owner') {
      throw new BadUserInputError(
        'Owners cannot leave. Transfer ownership first.',
      )
    }

    try {
      const removed = await FlowCollaborator.query()
        .delete()
        .where({
          flow_id: flowId,
          user_id: context.currentUser.id,
        })
        .returning(['user_id', 'role'])
        .throwIfNotFound({ message: 'No such collaborator found' })
      captureRemoval(removed, context.currentUser.id, flowId, 'left')
    } catch {
      logger.error({
        message: 'Failed to leave pipe as collaborator',
        data: {
          flowId,
          email,
        },
        userId: context.currentUser.id,
      })
      throw new Error('Failed to leave pipe')
    }

    return true
  }

  // only editor or owner can delete other collaborators
  await FlowCollaborator.hasAccess({
    userId: context.currentUser.id,
    flowId,
    requiredRole: 'editor',
  })

  const user = await User.query()
    .findOne({
      email: validatedEmail,
    })
    .throwIfNotFound('No such user found')

  try {
    const removed = await FlowCollaborator.query()
      .delete()
      .where({
        flow_id: flowId,
        user_id: user.id,
      })
      .returning(['user_id', 'role'])
      .throwIfNotFound({ message: 'No such collaborator found' })
    captureRemoval(removed, context.currentUser.id, flowId, 'app')
  } catch (e) {
    logger.error({
      message: 'Failed to delete collaborator',
      data: {
        flowId,
        email,
      },
      userId: context.currentUser.id,
      error: e,
    })
    throw new Error(
      e instanceof Error ? e.message : 'Failed to delete collaborator',
    )
  }

  return true
}

export default deleteFlowCollaborator
