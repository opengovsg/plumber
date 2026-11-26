import { useContext } from 'react'
import { useMutation } from '@apollo/client'
import { Spinner } from '@chakra-ui/react'
import {
  Button,
  TouchableTooltip,
  useToast,
} from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'
import { TRIGGER_FLOW_MANUALLY } from '@/graphql/mutations/trigger-flow-manually'

export default function RunNowButton() {
  const { flow } = useContext(EditorContext)

  const [triggerFlowManually, { loading }] = useMutation(TRIGGER_FLOW_MANUALLY)
  const toast = useToast()

  const isViewer = flow?.role === 'viewer'
  const isDisabled = !flow?.active || isViewer || loading

  const tooltipLabel = isViewer
    ? 'You do not have permission to run this pipe'
    : !flow?.active
    ? 'Publish this pipe before you can run it manually'
    : ''

  const handleRunNow = async () => {
    try {
      await triggerFlowManually({
        variables: {
          input: {
            flowId: flow.id,
          },
        },
      })

      toast({
        title: 'Your pipe has started running.',
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'bottom-right',
      })
    } catch {
      // The GraphQL error is already surfaced to the user via the global
      // Apollo error link (see ApolloProvider), so there is nothing more to
      // do here other than to avoid an unhandled rejection.
    }
  }

  return (
    <TouchableTooltip label={tooltipLabel} wrapperStyles={{ width: '100%' }}>
      <Button
        variant="outline"
        colorScheme="secondary"
        size="sm"
        isDisabled={isDisabled}
        isLoading={loading}
        spinner={<Spinner fontSize={24} />}
        onClick={handleRunNow}
      >
        Run now
      </Button>
    </TouchableTooltip>
  )
}
