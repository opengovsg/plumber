import { graphql } from '../__generated__/gql'

export const BULK_RETRY_EXECUTIONS = graphql(`
  mutation BulkRetryExecutions($input: BulkRetryExecutionsInput) {
    bulkRetryExecutions(input: $input) {
      numFailedExecutions
      allSuccessfullyRetried
    }
  }
`)
