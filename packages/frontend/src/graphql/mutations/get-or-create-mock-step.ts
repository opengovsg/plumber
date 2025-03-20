import { gql } from '@apollo/client'

export const GET_OR_CREATE_MOCK_STEP = gql`
  mutation GetOrCreateMockStep($input: GetOrCreateMockStepInput) {
    getOrCreateMockStep(input: $input) {
      id
    }
  }
`
