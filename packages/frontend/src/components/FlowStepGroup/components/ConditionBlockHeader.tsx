import type { ReactNode } from 'react'
import { useCallback, useContext } from 'react'
import { Flex, Text } from '@chakra-ui/react'

import { EditorContext } from '@/contexts/Editor'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

import UnsavedChangesAlert from '../../Editor/components/UnsavedChangesAlert'
import { conditionBlockStyles } from '../Content/IfThen/styles'
import type { ConditionPreviewPart } from '../helpers/getConditionBlockPreview'

/** Keeps the operator / value half of the sentence visible in the header. */
const MAX_VARIABLE_LABEL_LENGTH = 36

interface ConditionBlockHeaderProps {
  badgeLabel: string
  previewParts: ConditionPreviewPart[]
  stepId: string
  isSelected?: boolean
  actions?: ReactNode
}

/**
 * Shared header for nested condition blocks (IF / CONTINUE IF / REPEAT):
 * pink keyword badge as an inline span in the plain-language preview. Click
 * opens the step drawer. Hover actions overlay the trailing edge so the
 * sentence doesn’t reflow.
 */
export default function ConditionBlockHeader({
  badgeLabel,
  previewParts,
  stepId,
  isSelected = false,
  actions,
}: ConditionBlockHeaderProps): JSX.Element {
  const {
    currentStepId,
    isDrawerOpen,
    onDrawerClose,
    onDrawerOpen,
    setCurrentStepId,
  } = useContext(EditorContext)

  const {
    cancelRef,
    isWarningOpen,
    onWarningClose,
    handleProceed,
    handleLeave: discardChanges,
  } = useUnsavedChanges({
    onProceed: () => {
      setCurrentStepId(stepId)
      onDrawerOpen()
    },
  })

  const handleClick = useCallback(() => {
    if (isDrawerOpen && currentStepId === stepId) {
      setCurrentStepId(null)
      onDrawerClose()
      return
    }

    handleProceed()
  }, [
    currentStepId,
    handleProceed,
    isDrawerOpen,
    onDrawerClose,
    setCurrentStepId,
    stepId,
  ])

  const headerBg = isSelected ? 'primary.50' : conditionBlockStyles.header.bg

  return (
    <>
      <Flex
        {...conditionBlockStyles.header}
        position="relative"
        role="group"
        alignItems="center"
        cursor="pointer"
        bg={headerBg}
        _hover={{ bg: 'interaction.muted.neutral.hover' }}
        onClick={handleClick}
      >
        <Text
          flex="1"
          minW={0}
          noOfLines={2}
          textStyle="body-2"
          color="base.content.medium"
        >
          <Text
            as="span"
            display="inline-flex"
            alignItems="center"
            verticalAlign="text-bottom"
            px={2}
            py="2px"
            mr={2}
            borderRadius="md"
            bg="primary.100"
            color="primary.500"
            textStyle="caption-3"
          >
            {badgeLabel}
          </Text>
          {previewParts.map((part, index) => {
            if (part.type === 'text') {
              return <span key={`text-${index}`}>{part.text}</span>
            }

            const label =
              part.type === 'emphasis'
                ? part.text
                : truncateVariableLabel(part.label)

            return (
              <Text
                as="span"
                key={
                  part.type === 'emphasis'
                    ? `em-${index}`
                    : `var-${part.id}-${index}`
                }
                fontWeight="700"
                color="base.content.strong"
              >
                {label}
              </Text>
            )
          })}
        </Text>

        {actions && (
          <Flex
            position="absolute"
            top={0}
            right={0}
            bottom={0}
            zIndex={1}
            alignItems="center"
            gap={1}
            pl={2}
            pr={4}
            bg={headerBg}
            // Always on for touch; fade in over the text on desktop hover.
            opacity={{ base: 1, lg: 0 }}
            pointerEvents={{ base: 'auto', lg: 'none' }}
            transition="opacity 0.15s ease-in-out"
            _groupHover={{
              opacity: 1,
              pointerEvents: 'auto',
              bg: 'interaction.muted.neutral.hover',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </Flex>
        )}
      </Flex>

      <UnsavedChangesAlert
        cancelRef={cancelRef}
        isOpen={isWarningOpen}
        onClose={onWarningClose}
        onLeave={discardChanges}
      />
    </>
  )
}

function truncateVariableLabel(label: string): string {
  if (label.length <= MAX_VARIABLE_LABEL_LENGTH) {
    return label
  }
  return `${label.slice(0, MAX_VARIABLE_LABEL_LENGTH - 1)}…`
}
