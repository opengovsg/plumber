import { BiPlus } from 'react-icons/bi'
import { Box, Divider, useDisclosure } from '@chakra-ui/react'
import { IconButton, TouchableTooltip } from '@opengovsg/design-system-react'

import EmptyFlowStepHeader from '../EmptyFlowStepHeader'
import FlowStepConfigurationModal from '../FlowStepConfigurationModal'

interface AddStepButtonProps {
  isHidden: boolean
  isDisabled: boolean
  isLastStep: boolean
  showEmptyAction: boolean
  stepId: string
}

export function AddStepButton(props: AddStepButtonProps): JSX.Element {
  const { isHidden, isLastStep, stepId, isDisabled, showEmptyAction } = props
  const { isOpen, onOpen, onClose } = useDisclosure()

  // If in between add button is disabled, we hide it
  if (isHidden || (isDisabled && !isLastStep)) {
    return (
      <Box pos="relative" h={24} display="flex" justifyContent="center">
        {/* dont show line if last step, leave box for padding */}
        {!isLastStep && (
          <Divider orientation="vertical" borderColor="base.divider.strong" />
        )}
      </Box>
    )
  }

  return (
    <>
      <Box
        pos="relative"
        display="flex"
        flexDir="column"
        alignItems="center"
        alignSelf="stretch"
      >
        {/* Show empty action instead of add button */}
        {showEmptyAction && (
          <>
            {/* Top vertical line */}
            <Divider
              orientation="vertical"
              borderColor="base.divider.strong"
              h={20}
              my={2}
            />
            <EmptyFlowStepHeader isTrigger={false} onModalOpen={onOpen} />
          </>
        )}
        {/* Top vertical line */}
        <Box h={5}>
          <Divider orientation="vertical" borderColor="base.divider.strong" />
        </Box>
        <TouchableTooltip
          label={isDisabled ? '' : 'Add step'}
          placement="right"
          display={isDisabled && !isLastStep ? 'none' : 'flex'}
          marginX="auto"
        >
          <IconButton
            onClick={onOpen}
            aria-label="Add Step"
            isDisabled={isDisabled || showEmptyAction}
            icon={<BiPlus />}
            variant={isLastStep ? 'outline' : 'clear'}
            size="xs"
            color="interaction.sub.default"
            borderRadius="full"
            pointerEvents={isDisabled ? 'none' : 'auto'}
            _hover={{
              bg: 'interaction.muted.neutral.hover',
            }}
            _active={{
              bg: 'interaction.muted.neutral.active',
            }}
            borderColor={isLastStep ? 'interaction.sub.default' : undefined}
          />
        </TouchableTooltip>
        {/* Bottom vertical line */}
        {!isLastStep && (
          <Box h={5}>
            <Divider orientation="vertical" borderColor="base.divider.strong" />
          </Box>
        )}
      </Box>

      {isOpen && (
        <FlowStepConfigurationModal
          onClose={onClose}
          isTrigger={false} // Can only add an action all the time
          isLastStep={isLastStep}
          prevStepId={stepId}
        />
      )}
    </>
  )
}
