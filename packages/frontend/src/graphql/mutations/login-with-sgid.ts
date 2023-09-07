import { gql } from '@apollo/client'

export const LOGIN_WITH_SGID = gql`
  mutation LoginWithSgid($input: LoginWithSgidInput!) {
    loginWithSgid(input: $input) {
      nextUrl
      publicOfficerEmployments {
        workEmail
        agencyName
        departmentName
        employmentTitle
      }
    }
  }
`
