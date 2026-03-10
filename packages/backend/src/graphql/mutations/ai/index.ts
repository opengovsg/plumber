import type { MutationResolvers } from '../../__generated__/types.generated'

import generateAiSteps from './generate-ai-steps'
import refineFormInput from './refine-form-input'
import updateChatFeedback from './update-chat-feedback'

export default {
  generateAiSteps,
  refineFormInput,
  updateChatFeedback,
} satisfies MutationResolvers
