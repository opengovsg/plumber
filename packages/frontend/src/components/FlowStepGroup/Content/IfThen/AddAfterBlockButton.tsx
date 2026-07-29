import { useContext } from 'react'
import { BiPlus } from 'react-icons/bi'
import { Box, Divider, Flex, useDisclosure } from '@chakra-ui/react'
import { IconButton, TouchableTooltip } from '@opengovsg/design-system-react'

import UnsavedChangesAlert from '@/components/Editor/components/UnsavedChangesAlert'
import {
  type IfThenBlock,
  isIfThenBlockRegionConfined,
} from '@/components/Editor/helpers/steps-utils'
import FlowStepConfigurationModal from '@/components/FlowStepConfigurationModal'
import { EditorContext } from '@/contexts/Editor'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

import { HoverAddStepButton } from './HoverAddStepButton'

interface AddAfterBlockButtonProps {
  block: IfThenBlock
  isLastStep: boolean
  // Whether the block sits inside a for-each body, so its trailing connector
  // matches that body's HoverAddStepButton look instead of standing out.
  isNested?: boolean
}

/**
 * Adds a step after an if-then block, outside its rail.
 *
 * IMPORTANT: only sends `previousBlockId` when the block's region is
 * confined. The backend rejects an `endStepId` write that straddles an MRF
 * region.
 */
export function AddAfterBlockButton({
  block,
  isLastStep,
  isNested = false,
}: AddAfterBlockButtonProps): JSX.Element {
  const { flow, readOnly, isDrawerOpen } = useContext(EditorContext)
  const { isOpen, onOpen, onClose } = useDisclosure()

  const {
    cancelRef,
    isWarningOpen,
    onWarningClose,
    handleProceed,
    handleLeave,
  } = useUnsavedChanges({
    onProceed: onOpen,
  })

  const { ifThenStep, endStep } = block
  const previousBlockId = isIfThenBlockRegionConfined(flow.steps, ifThenStep)
    ? ifThenStep.id
    : undefined

  if (isNested) {
    return (
      <HoverAddStepButton
        isDisabled={readOnly}
        isDrawerOpen={isDrawerOpen}
        isLastStep={isLastStep}
        prevStep={endStep}
        step={endStep}
        previousBlockId={previousBlockId}
        // Same reasoning as the top-level path below: the anchor (the block's
        // last child) reads as "inside" the block unless told otherwise.
        anchorPlacement="after-if-then-block"
      />
    )
  }

  // Mirrors AddStepButton's read-only behavior, so a read-only block sits in
  // the same rhythm as a read-only step.
  if (readOnly) {
    return isLastStep ? (
      <></>
    ) : (
      <Flex flexDir="column" alignItems="center" w="100%">
        <Divider
          h={12}
          orientation="vertical"
          borderColor="base.divider.strong"
        />
      </Flex>
    )
  }

  return (
    <>
      {/*
        IMPORTANT: `pos="relative"` gives TouchableTooltip's hidden label a
        local containing block. Without it, the label's static position is
        computed against Editor's own wrapper, inflating its scrollHeight and
        producing a duplicate scrollbar.
      */}
      <Flex flexDir="column" alignItems="center" w="100%" pos="relative">
        <Box h={4}>
          <Divider orientation="vertical" />
        </Box>
        <TouchableTooltip label="Add step" placement="right" marginX="auto">
          <IconButton
            onClick={handleProceed}
            aria-label="Add step after block"
            icon={<BiPlus />}
            variant={isLastStep ? 'outline' : 'clear'}
            size="xs"
            color="interaction.sub.default"
            borderRadius="full"
            borderColor={isLastStep ? 'base.divider.strong' : undefined}
            _hover={{ bg: 'interaction.muted.neutral.hover' }}
            _active={{ bg: 'interaction.muted.neutral.active' }}
            h={8}
          />
        </TouchableTooltip>
        {!isLastStep && (
          <Box h={4}>
            <Divider orientation="vertical" />
          </Box>
        )}
      </Flex>

      {isOpen && (
        <FlowStepConfigurationModal
          onClose={onClose}
          isTrigger={false}
          isLastStep={isLastStep}
          prevStep={endStep}
          previousBlockId={previousBlockId}
          // previousBlockId can't say "after the whole block" either: it is
          // unset for a region-unconfined block.
          anchorPlacement="after-if-then-block"
        />
      )}

      <UnsavedChangesAlert
        cancelRef={cancelRef}
        isOpen={isWarningOpen}
        onClose={onWarningClose}
        onLeave={handleLeave}
      />
    </>
  )
}
