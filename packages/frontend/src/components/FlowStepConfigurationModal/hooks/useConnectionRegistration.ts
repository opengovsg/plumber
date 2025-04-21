// packages/frontend/src/hooks/useConnectionVerification.ts
import type { ITestConnectionOutput } from '@plumber/types'

import { useCallback, useContext } from 'react'
import { useLazyQuery, useMutation } from '@apollo/client'

import { EditorContext } from '@/contexts/Editor'
import { REGISTER_CONNECTION } from '@/graphql/mutations/register-connection'
import { TEST_CONNECTION } from '@/graphql/queries/test-connection'

interface UseConnectionVerificationProps {
  supportsConnectionRegistration: boolean
}

interface UseConnectionVerificationResult {
  testResult?: ITestConnectionOutput
  testResultLoading: boolean
  registerConnectionLoading: boolean
  testConnection: (
    connectionId: string,
  ) => Promise<ITestConnectionOutput | undefined>
  onRegisterConnection: (connectionId: string) => Promise<void>
}

export function useConnectionVerification(
  props: UseConnectionVerificationProps,
): UseConnectionVerificationResult {
  const { flowId } = useContext(EditorContext)
  const { supportsConnectionRegistration } = props

  const [
    testConnectionQuery,
    { loading: testResultLoading, data: testConnectionData },
  ] = useLazyQuery<{
    testConnection: ITestConnectionOutput
  }>(TEST_CONNECTION, {
    fetchPolicy: 'network-only',
  })

  // Caveat: Test connection data is returned here because testConnectionData
  // is not immediately updated (only happens after a re-render)
  const testConnection = useCallback(
    async (connectionId: string) => {
      const { data } = await testConnectionQuery({
        variables: {
          connectionId,
          flowId: supportsConnectionRegistration ? flowId : undefined,
        },
      })
      return data?.testConnection
    },
    [flowId, supportsConnectionRegistration, testConnectionQuery],
  )

  const [registerConnection, { loading: registerConnectionLoading }] =
    useMutation(REGISTER_CONNECTION)

  // register and retest connection
  const onRegisterConnection = useCallback(
    async (connectionId: string) => {
      if (connectionId && supportsConnectionRegistration) {
        await registerConnection({
          variables: {
            input: {
              connectionId,
              flowId,
            },
          },
        })
        await testConnection(connectionId)
      }
    },
    [
      supportsConnectionRegistration,
      registerConnection,
      flowId,
      testConnection,
    ],
  )

  return {
    testResult: testConnectionData?.testConnection,
    testResultLoading,
    registerConnectionLoading,
    testConnection,
    onRegisterConnection,
  }
}
