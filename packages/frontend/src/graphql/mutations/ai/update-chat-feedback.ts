import { gql } from '@apollo/client'

export const UPDATE_CHAT_FEEDBACK = gql`
  mutation updateChatFeedback($input: UpdateChatFeedbackInput!) {
    updateChatFeedback(input: $input)
  }
`
