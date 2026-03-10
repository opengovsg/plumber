import { graphql } from '@/graphql/__generated__'

export const VERIFY_TABLE_VIEW_PASSWORD = graphql(`
  mutation VerifyTableViewPassword($input: VerifyTableViewPasswordInput!) {
    verifyTableViewPassword(input: $input)
  }
`)
