import { IStep } from '@plumber/types'

import { useContext, useState } from 'react'
import { BiPlus } from 'react-icons/bi'
import { Divider, Flex, IconButton, useDisclosure } from '@chakra-ui/react'

import UnsavedChangesAlert from '@/components/Editor/UnsavedChangesAlert'
import EmptyFlowStepHeader from '@/components/EmptyFlowStepHeader'
import FlowStepConfigurationModal from '@/components/FlowStepConfigurationModal'
import { DRAG_HANDLE_WIDTH } from '@/components/SortableList/components/SortableItem'
import { EditorContext } from '@/contexts/Editor'
import { useStepMetadata } from '@/hooks/useStepMetadata'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

import { hoverAddStepButtonStyles as styles } from './styles'

interface HoverAddStepButtonProps {
  isDisabled: boolean
  isDrawerOpen: boolean
  isLastStep: boolean
  prevStepId: string
  showEmptyAction?: boolean
  step: IStep
  allowReorder?: boolean
  canChildStepsReorder?: boolean
}

export function HoverAddStepButton(
  props: HoverAddStepButtonProps,
): JSX.Element {
  const {
    isDisabled,
    isLastStep,
    prevStepId,
    showEmptyAction,
    step,
    allowReorder,
    canChildStepsReorder,
  } = props
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [isHovered, setIsHovered] = useState(false)

  const { allApps, readOnly, isMobile } = useContext(EditorContext)
  const { shouldShowDragHandle } = useStepMetadata(
    allApps,
    step,
    readOnly,
    allowReorder,
    isMobile,
  )

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
            (shouldShowDragHandle || canChildStepsReorder) && !isMobile
              ? `calc(100% - ${DRAG_HANDLE_WIDTH}px)`
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
          prevStepId={prevStepId}
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
