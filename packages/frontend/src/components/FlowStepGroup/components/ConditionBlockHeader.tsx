import type { ReactNode } from 'react'
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Flex, Text, Tooltip } from '@chakra-ui/react'

import { EditorContext } from '@/contexts/Editor'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

import UnsavedChangesAlert from '../../Editor/components/UnsavedChangesAlert'
import {
  BLOCK_ACTIONS_OVERLAY_WIDTH_PX,
  blockActionsOverlayStyles,
  conditionBlockStyles,
} from '../Content/IfThen/styles'
import { buildConditionSentence } from '../helpers/buildConditionSentence'
import type { ConditionPreviewPart } from '../helpers/getConditionBlockPreview'

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
 * opens the step drawer.
 *
 * Actions overlay the trailing edge rather than sitting beside the text, so
 * revealing them on hover doesn't reflow the sentence. The cost is that they
 * cover the tail of the text, so the text reserves room for them at the widths
 * where they are always visible (see `pr` below); on desktop they only appear
 * on hover, and the tooltip covers what they hide.
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
    varInfoMap,
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

  const { parts, fullSentence, isLeadingTruncated } = useMemo(
    () =>
      buildConditionSentence(
        badgeLabel,
        previewParts,
        (id) => varInfoMap.get(`{{${id}}}`)?.label,
      ),
    [badgeLabel, previewParts, varInfoMap],
  )

  /**
   * Whether the clamp is hiding anything. Needed because the value half is now
   * cut by layout rather than by character count, which no amount of measuring
   * the string can predict — so the rendered box is asked directly, and again
   * whenever it is resized (opening the drawer re-flows every block).
   */
  const clampedTextRef = useRef<HTMLParagraphElement>(null)
  const [isClamped, setIsClamped] = useState(false)

  useEffect(() => {
    const element = clampedTextRef.current
    if (!element) {
      return
    }

    const measure = () =>
      setIsClamped(element.scrollHeight > element.clientHeight + 1)

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [parts])

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
        <Tooltip
          // Only when something was actually cut: a tooltip repeating text
          // already fully on screen is noise.
          isDisabled={!isLeadingTruncated && !isClamped}
          label={fullSentence}
          placement="top-start"
          openDelay={300}
          hasArrow
        >
          <Text
            ref={clampedTextRef}
            flex="1"
            minW={0}
            noOfLines={2}
            textStyle="body-2"
            color="base.content.medium"
            // Room for the actions overlay only at the widths where it is always
            // on. Reserving it on desktop too would cost a quarter of the line
            // at the 320px minimum to buttons that are usually hidden.
            pr={{
              base: actions ? `${BLOCK_ACTIONS_OVERLAY_WIDTH_PX}px` : 0,
              lg: 0,
            }}
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
            {parts.map((part, index) => {
              // Connectives and typed values read as ordinary prose; only
              // variables (and the for-each keyword) are picked out in bold.
              if (part.type === 'text' || part.type === 'literal') {
                return <span key={`${part.type}-${index}`}>{part.display}</span>
              }

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
                  {part.display}
                </Text>
              )
            })}
          </Text>
        </Tooltip>

        {actions && (
          <Flex
            position="absolute"
            top={0}
            right={0}
            bottom={0}
            zIndex={1}
            alignItems="center"
            {...blockActionsOverlayStyles}
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
