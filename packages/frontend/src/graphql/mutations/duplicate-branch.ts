import { gql } from '@apollo/client'

export const DUPLICATE_BRANCH = gql`
  mutation DuplicateBranch($input: DuplicateBranchInput) {
    duplicateBranch(input: $input) {
      flow {
        updatedAt
      }
      steps {
        id
        type
        key
        appKey
        parameters
        position
        status
        connection {
          id
        }
        config {
          stepName
          endStepId
        }
      }
    }
  }
`
