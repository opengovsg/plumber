import { gql } from '@apollo/client'

export const GET_CHAT_READINESS = gql`
  query GetChatReadiness($message: String!, $sessionId: String!) {
    getChatReadiness(message: $message, sessionId: $sessionId) {
      isReady
    }
  }
`
