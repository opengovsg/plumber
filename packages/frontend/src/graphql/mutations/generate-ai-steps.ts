import { gql } from '@apollo/client'

export const GENERATE_AI_STEPS = gql`
  mutation generateAiSteps($input: GenerateAiStepsInput!) {
    generateAiSteps(input: $input)
  }
`
