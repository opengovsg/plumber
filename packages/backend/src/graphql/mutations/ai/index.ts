import type { MutationResolvers } from '../../__generated__/types.generated'

import generateAiSteps from './generate-ai-steps'
import updateChatFeedback from './update-chat-feedback'

export default {
  generateAiSteps,
  updateChatFeedback,
} satisfies MutationResolvers
