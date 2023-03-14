import { IUser } from '@plumber/types'

import { useQuery } from '@apollo/client'
import { GET_CURRENT_USER } from 'graphql/queries/get-current-user'

export default function useCurrentUser(): IUser {
  const { data } = useQuery(GET_CURRENT_USER)

  return data?.getCurrentUser
}
