import appConfig from '@/config/app'
import { langfuseClient } from '@/helpers/langfuse'
import logger from '@/helpers/logger'

import { MutationResolvers } from '../../__generated__/types.generated'

const updateChatFeedback: MutationResolvers['updateChatFeedback'] = async (
  _parent,
  params,
  context,
) => {
  const { traceId, feedback, score } = params.input

  try {
    langfuseClient.score.create({
      traceId,
      id: `feedback-${traceId}-${context.currentUser.email}`,
      environment: appConfig.appEnv,
      name: 'user-feedback',
      value: score, // 1 for positive, 0 for negative
      comment: feedback.comment as string,
      metadata: feedback?.category
        ? { category: feedback.category }
        : { category: null }, // NOTE: we need to set to null as Langfuse will merge instead of overwriting metadata
    })

    return true
  } catch (error) {
    logger.error('Failed to update chat feedback', { error })
    // we don't throw because it doesn't stop the user from using the chat
    return false
  }
}

export default updateChatFeedback
