import { gql } from '@apollo/client'

export const REFINE_FORM_INPUT = gql`
  mutation refineFormInput($input: RefineFormInputInput!) {
    refineFormInput(input: $input)
  }
`
