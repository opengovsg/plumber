import { graphql } from '@/graphql/__generated__'

export const HEALTHCHECK = graphql(`
  query Healthcheck {
    healthcheck {
      version
    }
  }
`)
