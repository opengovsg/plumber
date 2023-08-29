import { gql } from '@apollo/client'

export const REGISTER_WEBHOOK = gql`
  mutation RegisterWebhook($input: RegisterWebhookInput) {
    registerWebhook(input: $input)
  }
`
