import { IFlow } from '@plumber/types'

import { Skeleton, Spinner, Text } from '@chakra-ui/react'
import { Button, TouchableTooltip } from '@opengovsg/design-system-react'

export default function PublishButton({
  flow,
  hasFlowTransfer,
  isFlowIncomplete,
  loading,
  shouldWarnOnLeave,
  handleWarnOnLeave,
  onFlowStatusUpdate,
  setShouldWarnOnPublish,
}: {
  flow: IFlow
  hasFlowTransfer: boolean
  isFlowIncomplete: boolean
  loading: boolean
  shouldWarnOnLeave: boolean
  handleWarnOnLeave: (e: React.MouseEvent<HTMLButtonElement>) => void
  onFlowStatusUpdate: (active: boolean) => void
  setShouldWarnOnPublish: (shouldWarnOnPublish: boolean) => void
}) {
  return (
    <TouchableTooltip
      label={
        isFlowIncomplete
          ? 'Set up for all steps must be completed before you can publish your pipe'
          : hasFlowTransfer
          ? 'You cannot publish a pipe with a pending transfer'
          : ''
      }
      wrapperStyles={{ width: '100%' }}
    >
      <Button
        isDisabled={isFlowIncomplete || hasFlowTransfer}
        isLoading={loading}
        spinner={<Spinner fontSize={24} />}
        size="sm"
        w="full"
        onClick={(e) => {
          if (shouldWarnOnLeave) {
            setShouldWarnOnPublish(true)
            handleWarnOnLeave(e)
          } else {
            onFlowStatusUpdate(!flow.active)
          }
        }}
      >
        <Skeleton isLoaded={!loading}>
          <Text textStyle="subhead-1">
            {flow?.active ? 'Unpublish' : 'Publish'}
          </Text>
        </Skeleton>
      </Button>
    </TouchableTooltip>
  )
}
