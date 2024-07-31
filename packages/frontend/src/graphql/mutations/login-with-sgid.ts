import { graphql } from '@/graphql/__generated__'

export const LOGIN_WITH_SGID = graphql(`
  mutation LoginWithSgid($input: LoginWithSgidInput!) {
    loginWithSgid(input: $input) {
      publicOfficerEmployments {
        workEmail
        agencyName
        departmentName
        employmentTitle
      }
    }
  }
`)
