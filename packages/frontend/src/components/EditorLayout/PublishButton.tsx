import { useContext, useMemo } from 'react'
import { Skeleton, Spinner, Text } from '@chakra-ui/react'
import { Button, TouchableTooltip } from '@opengovsg/design-system-react'

import { hasEmptyIfThenV2Block } from '@/components/Editor/helpers/steps-utils'
import { EditorContext } from '@/contexts/Editor'
import { TOOLBOX_APP_KEY } from '@/helpers/toolbox'

const unpublishButtonStyles = {
  bg: 'base.content.strong',
  color: 'white',
  borderColor: 'base.content.strong',
  _hover: {
    bg: 'base.content.default',
    borderColor: 'base.content.default',
    _disabled: {
      bg: 'interaction.support.disabled',
      borderColor: 'interaction.support.disabled',
    },
  },
  _active: {
    bg: 'grey.900',
    borderColor: 'grey.900',
  },
}

export default function PublishButton({
  loading,
  shouldWarnOnLeave,
  handleWarnOnLeave,
  onFlowStatusUpdate,
  onUnpublish,
  setShouldWarnOnPublish,
}: {
  loading: boolean
  shouldWarnOnLeave: boolean
  handleWarnOnLeave: (e: React.MouseEvent<HTMLButtonElement>) => void
  onFlowStatusUpdate: (active: boolean) => void
  onUnpublish: () => void
  setShouldWarnOnPublish: (shouldWarnOnPublish: boolean) => void
}) {
  const {
    flow,
    hasFlowTransfer,
    isLoading: isEditorContextLoading,
  } = useContext(EditorContext)

  // disallow user from publishing pipe if any step is incomplete
  const isFlowIncomplete = useMemo(
    () =>
      flow?.steps.length < 2 ||
      flow?.steps.some((step) => step.status === 'incomplete') ||
      // NOTE: toolbox apps should have action steps after them
      // this is relevant in the for-each action where we use the EmptyFlowStepHeader
      // instead of creating an empty step
      flow?.steps[flow?.steps.length - 1].appKey === TOOLBOX_APP_KEY,
    [flow?.steps],
  )

  // The backend already refuses to publish a flow with an empty if-then V2
  // block. Disable the button here too, so the user doesn't attempt it.
  const hasEmptyIfThenBlock = useMemo(
    () => hasEmptyIfThenV2Block(flow?.steps ?? []),
    [flow?.steps],
  )

  return (
    <TouchableTooltip
      label={
        flow.role === 'viewer'
          ? 'You do not have permission to edit this pipe'
          : hasFlowTransfer
          ? 'You cannot publish a pipe with a pending transfer'
          : isFlowIncomplete
          ? 'Set up for all steps must be completed before you can publish your pipe'
          : hasEmptyIfThenBlock
          ? 'Your If-then has no steps in it'
          : ''
      }
      wrapperStyles={{ width: '100%' }}
    >
      <Button
        isDisabled={
          isFlowIncomplete ||
          hasEmptyIfThenBlock ||
          hasFlowTransfer ||
          flow.role === 'viewer'
        }
        isLoading={loading || isEditorContextLoading}
        spinner={<Spinner fontSize={24} />}
        size="sm"
        minW="120px" // set this to avoid button width changing on publish/unpublish
        {...(flow?.active ? unpublishButtonStyles : {})}
        onClick={(e) => {
          if (flow.active) {
            onUnpublish()
            return
          }
          if (shouldWarnOnLeave) {
            setShouldWarnOnPublish(true)
            handleWarnOnLeave(e)
          } else {
            onFlowStatusUpdate(true)
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
