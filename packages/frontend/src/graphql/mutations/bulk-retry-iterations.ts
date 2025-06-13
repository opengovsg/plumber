import { graphql } from '../__generated__/gql'

export const BULK_RETRY_ITERATIONS = graphql(`
  mutation BulkRetryIterations($input: BulkRetryIterationsInput) {
    bulkRetryIterations(input: $input) {
      numFailedIterations
      allSuccessfullyRetried
    }
  }
`)
