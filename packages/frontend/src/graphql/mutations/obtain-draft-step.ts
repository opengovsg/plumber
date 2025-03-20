import { gql } from '@apollo/client'

export const OBTAIN_DRAFT_STEP = gql`
  mutation ObtainDraftStep($input: ObtainDraftStepInput) {
    obtainDraftStep(input: $input) {
      id
    }
  }
`
