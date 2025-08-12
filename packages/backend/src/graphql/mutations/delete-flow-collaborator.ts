import { BadUserInputError } from '@/errors/graphql-errors'
import { validateAndParseEmail } from '@/helpers/email-validator'
import logger from '@/helpers/logger'
import FlowCollaborator from '@/models/flow-collaborators'
import User from '@/models/user'

import { MutationResolvers } from '../__generated__/types.generated'

const deleteFlowCollaborator: MutationResolvers['deleteFlowCollaborator'] =
  async (_parent, params, context) => {
    const { flowId, email } = params.input as {
      flowId: string
      email: string
    }

    const validatedEmail = await validateAndParseEmail(email)
    if (!validatedEmail) {
      throw new BadUserInputError('Invalid collaborator email')
    }

    if (validatedEmail === context.currentUser.email) {
      throw new BadUserInputError('Cannot remove yourself')
    }

    // only editor or owner can delete collaborators
    const isOwner = await context.currentUser.$relatedQuery('flows').findOne({
      id: flowId,
    })

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

    if (isOwner?.userId === user.id) {
      throw new BadUserInputError('Cannot remove owner')
    }

    const collaboratorUser = await FlowCollaborator.query()
      .findOne({
        flow_id: flowId,
        user_id: user.id,
      })
      .throwIfNotFound('No such collaborator found')

    try {
      await collaboratorUser.$query().delete()
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
      throw new Error(e.message ?? 'Failed to delete collaborator')
    }

    return true
  }

export default deleteFlowCollaborator
