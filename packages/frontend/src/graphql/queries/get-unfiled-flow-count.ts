import { graphql } from '@/graphql/__generated__'

export const GET_UNFILED_FLOW_COUNT = graphql(`
  query GetUnfiledFlowCount {
    getUnfiledFlowCount
  }
`)
