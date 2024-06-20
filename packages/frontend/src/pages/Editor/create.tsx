import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { CircularProgress, Flex, Text } from '@chakra-ui/react'
import * as URLS from 'config/urls'
import { CREATE_FLOW } from 'graphql/mutations/create-flow'

export default function CreateFlow(): React.ReactElement {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [createFlow] = useMutation(CREATE_FLOW)

  const appKey = searchParams.get('appKey')
  const connectionId = searchParams.get('connectionId')

  useEffect(() => {
    async function initiate() {
      const variables: { [key: string]: string } = {}

      if (appKey) {
        variables.triggerAppKey = appKey
      }

      if (connectionId) {
        variables.connectionId = connectionId
      }

      const response = await createFlow({
        variables: {
          input: variables,
        },
      })
      const flowId = response.data?.createFlow?.id

      navigate(URLS.FLOW_EDITOR(flowId), { replace: true })
    }

    initiate()
  }, [createFlow, navigate, appKey, connectionId])

  return (
    <Flex
      flex={1}
      h="100vh"
      justifyContent="center"
      alignItems="center"
      gap={2}
    >
      <CircularProgress size={16} thickness={7.5} />
      <Text textStyle="body-2">Creating a pipe...</Text>
    </Flex>
  )
}
