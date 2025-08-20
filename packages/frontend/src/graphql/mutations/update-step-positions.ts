import { graphql } from '@/graphql/__generated__'

export const UPDATE_STEP_POSITIONS = graphql(`
  mutation UpdateStepPositions($input: UpdateStepPositionsInput!) {
    updateStepPositions(input: $input) {
      id
      position
    }
  }
`)
