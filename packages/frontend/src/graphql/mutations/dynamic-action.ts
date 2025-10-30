import { graphql } from '@/graphql/__generated__'

export const DYNAMIC_ACTION = graphql(`
  mutation DynamicAction($input: DynamicActionInput!) {
    dynamicAction(input: $input)
  }
`)
