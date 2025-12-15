import { IStep, IStepApprovalBranch } from '@plumber/types'

import { useMemo } from 'react'
import { BiPlus } from 'react-icons/bi'
import { Box, Divider, useDisclosure } from '@chakra-ui/react'
import { IconButton, TouchableTooltip } from '@opengovsg/design-system-react'

import EmptyFlowStepHeader from '@/components/EmptyFlowStepHeader'
import FlowStepConfigurationModal from '@/components/FlowStepConfigurationModal'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

import UnsavedChangesAlert from './UnsavedChangesAlert'

interface AddStepButtonProps {
  isHidden: boolean
  isDisabled: boolean
  isLastStep: boolean
  showEmptyAction: boolean
  step: IStep
  approvalBranch: IStepApprovalBranch
}

export function AddStepButton(props: AddStepButtonProps): JSX.Element {
  const {
    isHidden,
    isLastStep,
    step,
    isDisabled,
    showEmptyAction,
    approvalBranch,
  } = props
  const { isOpen, onOpen, onClose } = useDisclosure()

  const { dividerColor, iconBgColor } = useMemo(() => {
    if (approvalBranch === undefined) {
      return {
        dividerColor: 'base.divider.strong',
        iconBgColor: undefined,
      }
    }
    if (approvalBranch === 'approve') {
      return {
        dividerColor: 'green.500',
        iconBgColor: 'green.50',
      }
    }
    return {
      dividerColor: 'red.500',
      iconBgColor: 'red.50',
    }
  }, [approvalBranch])

  const {
    cancelRef,
    isWarningOpen,
    onWarningClose,
    handleProceed,
    handleLeave,
  } = useUnsavedChanges({
    onProceed: onOpen,
  })

  return (
    <Box
      pos="relative"
      display="flex"
      flexDir="column"
      alignItems="center"
      alignSelf="stretch"
      h="auto"
      w="100%"
    >
      {isHidden || (isDisabled && !isLastStep) ? (
        !isLastStep && (
          // If in between add button is disabled, we hide it
          <Divider
            h={12}
            orientation="vertical"
            borderColor="base.divider.strong"
          />
        )
      ) : (
        <>
          {/* Show empty action instead of add button */}
          {showEmptyAction && (
            <>
              {/* Top vertical line */}
              <Divider
                orientation="vertical"
                borderColor="base.divider.strong"
                h={12}
              />
              <EmptyFlowStepHeader
                isTrigger={false}
                onModalOpen={handleProceed}
              />
            </>
          )}
          {/* Top vertical line */}
          <Box h={6}>
            <Divider orientation="vertical" borderColor={dividerColor} />
          </Box>
          <TouchableTooltip
            label={isDisabled ? '' : 'Add step'}
            placement="right"
            display={isDisabled && !isLastStep ? 'none' : 'flex'}
            marginX="auto"
          >
            <IconButton
              onClick={handleProceed}
              aria-label="Add Step"
              isDisabled={isDisabled || showEmptyAction}
              icon={<BiPlus />}
              variant={isLastStep ? 'outline' : 'clear'}
              size="xs"
              color="interaction.sub.default"
              bg={iconBgColor}
              borderRadius="full"
              pointerEvents={isDisabled ? 'none' : 'auto'}
              _hover={{
                bg: 'interaction.muted.neutral.hover',
              }}
              _active={{
                bg: 'interaction.muted.neutral.active',
              }}
              borderColor={isLastStep ? dividerColor : undefined}
              h={8}
            />
          </TouchableTooltip>
          {/* Bottom vertical line */}
          {!isLastStep && (
            <Box h={6}>
              <Divider orientation="vertical" borderColor={dividerColor} />
            </Box>
          )}

          {isOpen && (
            <FlowStepConfigurationModal
              onClose={onClose}
              isTrigger={false} // Can only add an action all the time
              isLastStep={isLastStep}
              prevStep={step}
            />
          )}
        </>
      )}

      <UnsavedChangesAlert
        cancelRef={cancelRef}
        isOpen={isWarningOpen}
        onClose={onWarningClose}
        onLeave={handleLeave}
      />
    </Box>
  )
}
