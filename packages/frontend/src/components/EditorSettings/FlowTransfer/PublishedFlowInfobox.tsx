import { useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { Flex, Text } from '@chakra-ui/react'
import { Button, Infobox } from '@opengovsg/design-system-react'
import { UPDATE_FLOW_STATUS } from 'graphql/mutations/update-flow-status'

interface PublishedFlowInfoboxProps {
  isActive: boolean
}

export default function PublishedFlowInfobox(props: PublishedFlowInfoboxProps) {
  const { isActive } = props
  const { flowId } = useParams()
  const [updateFlowStatus] = useMutation(UPDATE_FLOW_STATUS)

  const onFlowStatusUpdate = useCallback(
    async (active: boolean) => {
      await updateFlowStatus({
        variables: {
          input: {
            id: flowId,
            active,
          },
        },
        optimisticResponse: {
          updateFlowStatus: {
            __typename: 'Flow',
            id: flowId,
            active,
          },
        },
      })
    },
    [flowId, updateFlowStatus],
  )

  return (
    <Infobox alignItems={{ base: 'flex-start', sm: 'center' }}>
      <Flex
        flexDir={{ base: 'column', sm: 'row' }}
        gap={2}
        justifyContent="space-between"
        alignItems="center"
        flex={1}
      >
        <Text>You will need to unpublish your pipe before you transfer it</Text>
        <Button
          onClick={() => onFlowStatusUpdate(!isActive)}
          variant="clear"
          colorScheme="secondary"
        >
          Unpublish Pipe
        </Button>
      </Flex>
    </Infobox>
  )
}
