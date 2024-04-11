import { useCallback, useContext } from 'react'
import { useMutation } from '@apollo/client'
import { Flex, Text } from '@chakra-ui/react'
import { Button, Infobox } from '@opengovsg/design-system-react'
import { EditorSettingsContext } from 'contexts/EditorSettings'
import { UPDATE_FLOW_STATUS } from 'graphql/mutations/update-flow-status'

export default function PublishedFlowInfobox() {
  const { flow } = useContext(EditorSettingsContext)
  const [updateFlowStatus] = useMutation(UPDATE_FLOW_STATUS)

  const onFlowStatusUpdate = useCallback(
    async (active: boolean) => {
      await updateFlowStatus({
        variables: {
          input: {
            id: flow.id,
            active,
          },
        },
        optimisticResponse: {
          updateFlowStatus: {
            __typename: 'Flow',
            id: flow.id,
            active,
          },
        },
      })
    },
    [flow.id, updateFlowStatus],
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
          onClick={() => onFlowStatusUpdate(!flow.active)}
          variant="clear"
          colorScheme="secondary"
        >
          Unpublish Pipe
        </Button>
      </Flex>
    </Infobox>
  )
}
