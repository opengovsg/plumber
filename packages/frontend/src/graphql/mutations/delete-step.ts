import { graphql } from '@/graphql/__generated__'

export const DELETE_STEP = graphql(`
  mutation DeleteStep($input: DeleteStepInput) {
    deleteStep(input: $input) {
      id
      steps {
        id
      }
    }
  }
`)
