import { IStep } from '@plumber/types'

import { useContext, useState } from 'react'
import { BiPlus } from 'react-icons/bi'
import { Divider, Flex, IconButton, useDisclosure } from '@chakra-ui/react'

import UnsavedChangesAlert from '@/components/Editor/components/UnsavedChangesAlert'
import EmptyFlowStepHeader from '@/components/EmptyFlowStepHeader'
import FlowStepConfigurationModal from '@/components/FlowStepConfigurationModal'
import { NESTED_DRAG_HANDLE_WIDTH } from '@/components/SortableList/components/SortableItem'
import { EditorContext } from '@/contexts/Editor'
import { useStepMetadata } from '@/hooks/useStepMetadata'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

import { hoverAddStepButtonStyles as styles } from './styles'

interface HoverAddStepButtonProps {
  isDisabled: boolean
  isDrawerOpen: boolean
  isLastStep: boolean
  prevStep: IStep
  showEmptyAction?: boolean
  step: IStep
  allowReorder?: boolean
  canChildStepsReorder?: boolean
  // Set only when this button stands in for AddAfterBlockButton (an if-then
  // V2 block nested in a for-each body), to pin/upgrade the block's marker
  // as the top-level button would.
  previousBlockId?: string
}

export function HoverAddStepButton(
  props: HoverAddStepButtonProps,
): JSX.Element {
  const {
    isDisabled,
    isLastStep,
    prevStep,
    showEmptyAction,
    step,
    allowReorder,
    canChildStepsReorder,
    previousBlockId,
  } = props
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [isHovered, setIsHovered] = useState(false)

  const { readOnly, isDrawerOpen } = useContext(EditorContext)
  const { shouldShowDragHandle } = useStepMetadata(step, allowReorder)

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
    <>
      {showEmptyAction ? (
        <Flex flexDir="column" alignItems="center" mb={1}>
          <Flex h="2rem">
            <Divider orientation="vertical" borderColor="base.divider.strong" />
          </Flex>
          <EmptyFlowStepHeader
            isNested={true}
            isTrigger={false}
            onModalOpen={handleProceed}
          />
        </Flex>
      ) : (
        <Flex
          {...styles.container}
          h={isHovered ? 8 : isLastStep ? 4 : 6}
          mb={isLastStep ? 0 : 1}
          pointerEvents={isDisabled ? 'none' : 'auto'}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          w={
            (shouldShowDragHandle || canChildStepsReorder) &&
            !isDrawerOpen &&
            !readOnly
              ? `calc(100% - ${NESTED_DRAG_HANDLE_WIDTH}px)`
              : 'full'
          }
        >
          {/* vertical line */}
          {!isLastStep && (
            <Flex h="2rem" opacity={1} _groupHover={{ display: 'none' }}>
              <Divider
                orientation="vertical"
                borderColor="base.divider.strong"
              />
            </Flex>
          )}
          {!isDisabled && isHovered && (
            <IconButton
              {...styles.button}
              aria-label="Add Step"
              onClick={handleProceed}
              isDisabled={isDisabled}
              icon={<BiPlus />}
            />
          )}
        </Flex>
      )}

      {isOpen && (
        <FlowStepConfigurationModal
          onClose={onClose}
          isTrigger={false} // Can only add an action all the time
          isLastStep={isLastStep}
          prevStep={prevStep}
          previousBlockId={previousBlockId}
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
