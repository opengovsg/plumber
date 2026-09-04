import { Box, CircularProgress, Flex, useDisclosure } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'
import type { IStep } from '@plumber/types'
import { useCallback, useContext, useMemo } from 'react'
import { BiInfoCircle, BiSolidErrorCircle } from 'react-icons/bi'

import { EditorContext } from '@/contexts/Editor'
import { MarkdownRenderer } from '@/exports/components'
import { getFlowStepHeaderWidth } from '@/helpers/editor'
import { replacePlaceholdersForHelpMessage } from '@/helpers/flow-templates'
import { validateStepParams } from '@/helpers/validateStepParams'
import { useStepMetadata } from '@/hooks/useStepMetadata'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

import UnsavedChangesAlert from '../Editor/components/UnsavedChangesAlert'
import EmptyFlowStepHeader from '../EmptyFlowStepHeader'
import ErrorFlowStepHeader from '../ErrorFlowStepHeader'
import FlowStepConfigurationModal from '../FlowStepConfigurationModal'
import { infoboxMdComponents } from '../MarkdownRenderer/CustomMarkdownComponents'
import { DragHandle } from '../SortableList/components'
import { NESTED_DRAG_HANDLE_WIDTH } from '../SortableList/components/SortableItem'
import { ApproveReject } from './components/ApproveReject'
import DeleteStepButton from './components/DeleteStepButton'
import DuplicateStepButton from './components/DuplicateStepButton'
import StepAppIcon from './components/StepAppIcon'
import StepNameAndDemo from './components/StepNameAndDemo'
import TestAgainInfobox from './components/TestAgainInfobox'
import FlowStepWrapper from './FlowStepWrapper'
import { flowStepStyles, NESTED_FLOW_STEP_HEIGHT } from './styles'

type FlowStepProps = {
  step: IStep
  isLastStep: boolean
  isNested?: boolean
  allowReorder?: boolean
  // we use this to control the width of condition steps in if-then and for-each
  canChildStepsReorder?: boolean
  // An if-then V2 block titles its condition step with the block's own name,
  // so the block's header reads as the block rather than a generic
  // "Condition".
  stepNameOverride?: string
  // An if-then V2 block's condition step doubles as the block's header, so
  // the block reads as one big step rather than a card holding a card. The
  // owning container supplies the selected-state border this drops.
  isContainerHeader?: boolean
  // An if-then V2 block's header is a step's usual visuals standing in for
  // the block's name. It is not a step of its own to configure. That's the
  // condition card beneath it.
  isClickable?: boolean
  // An if-then V2 block's condition card drops its own number since the
  // block's header above already shows one.
  hideDisplayPosition?: boolean
}

export default function FlowStep(
  props: FlowStepProps,
): React.ReactElement | null {
  const {
    step,
    isLastStep,
    isNested,
    allowReorder = true,
    canChildStepsReorder = false,
    stepNameOverride,
    isContainerHeader = false,
    isClickable = true,
    hideDisplayPosition = false,
  } = props

  // IMPORTANT: borderTopRadius has to be reset explicitly, not just
  // borderRadius. It maps to the corner longhands, which beat the shorthand
  // regardless of prop order.
  const containerHeaderStyles = isContainerHeader
    ? {
        borderWidth: 0,
        borderTopWidth: 0,
        borderRadius: 'none',
        borderTopRadius: 'none',
      }
    : {}

  const {
    isOpen: isModalOpen,
    onOpen: onModalOpen,
    onClose: onModalClose,
  } = useDisclosure()

  const {
    allApps,
    currentStepId,
    flow,
    isDrawerOpen,
    isMobile,
    readOnly,
    shouldWarnOnLeave,
    testExecutionSteps,
    onDrawerClose,
    onDrawerOpen,
    setCurrentStepId,
    setShouldWarnOnLeave,
  } = useContext(EditorContext)
  const {
    app,
    stepName: derivedStepName,
    displayPosition,
    isCompleted,
    isTrigger,
    selectedActionOrTrigger,
    substeps,
    shouldShowDragHandle,
    isDeletable,
    isApprovalStep,
    isMrfStep,
    warnsMrfNoGate,
  } = useStepMetadata(step, allowReorder)
  const stepName = stepNameOverride ?? derivedStepName

  const {
    cancelRef,
    isWarningOpen,
    onWarningOpen,
    onWarningClose,
    handleProceed,
    handleLeave: discardChanges,
  } = useUnsavedChanges({
    onProceed: onModalOpen,
  })

  const { shouldTestStepAgain, isTestSuccessful } = useMemo(
    () => validateStepParams(step, testExecutionSteps, substeps),
    [step, substeps, testExecutionSteps],
  )

  const shouldHighlight = currentStepId === step.id

  const handleClick = useCallback(() => {
    if (!app) {
      onModalOpen()
      return
    }

    if (shouldWarnOnLeave) {
      onWarningOpen()
      return
    }

    if (isDrawerOpen && currentStepId === step.id) {
      setCurrentStepId(null)
      onDrawerClose()
    } else {
      setCurrentStepId(step.id)
      onDrawerOpen()
    }
  }, [
    app,
    currentStepId,
    isDrawerOpen,
    shouldWarnOnLeave,
    step.id,
    onDrawerClose,
    onDrawerOpen,
    onModalOpen,
    onWarningOpen,
    setCurrentStepId,
  ])

  const onLeave = () => {
    if (currentStepId === step.id) {
      setCurrentStepId(null)
      setShouldWarnOnLeave(false)
      onDrawerClose()
    } else if (!app || !selectedActionOrTrigger) {
      setShouldWarnOnLeave(false)
      discardChanges()
    } else {
      setCurrentStepId(step.id)
    }
  }

  const headerWidth = getFlowStepHeaderWidth(isDrawerOpen, isMobile, isNested)

  // A nested step's drag handle takes its width from the card's right edge,
  // pulling the card off the flow's centre line. This offset shifts the card
  // back to centre.
  const nestedHandleOffset =
    isNested && shouldShowDragHandle ? NESTED_DRAG_HANDLE_WIDTH / 2 : 0

  // generate help message only if template config exists
  const stepAppEventKey = `${step?.appKey}_${step?.key}`
  const templateStepAppEventKey = step.config.templateConfig?.appEventKey

  const templateStepHelpMessage = useMemo(() => {
    if (step.config.templateConfig?.customTemplate) {
      return step.config.templateConfig.customTemplate
    }

    return replacePlaceholdersForHelpMessage(
      templateStepAppEventKey,
      flow?.config?.templateConfig,
    )
  }, [
    step.config.templateConfig?.customTemplate,
    templateStepAppEventKey,
    flow?.config?.templateConfig,
  ])

  // Only show if the template step app key matches the current step app key
  // and has a help message (once tested successfully, the template step app key is removed)
  const shouldShowTemplateMsg: boolean =
    (stepAppEventKey === templateStepAppEventKey &&
      !!templateStepHelpMessage) ||
    !!step.config.templateConfig?.customTemplate

  // Persistent reminder on the MRF trigger step that the FormSG connection is
  // read-only: these steps are based on the form, Plumber never edits it.
  const showMrfReadOnlyNote = isMrfStep && isTrigger

  // NOTE: there will only be 1 infobox shown at a time
  // there will not be a situation where both are shown as template messages
  // are removed once user executes a successful test
  const hasInfoBox =
    shouldShowTemplateMsg ||
    shouldTestStepAgain ||
    showMrfReadOnlyNote ||
    warnsMrfNoGate

  if (!allApps) {
    return <CircularProgress isIndeterminate my={2} />
  }

  return (
    <FlowStepWrapper
      canChildStepsReorder={canChildStepsReorder}
      allowReorder={allowReorder}
      isDrawerOpen={isDrawerOpen}
      isReadOnly={readOnly}
    >
      {!app ? (
        <EmptyFlowStepHeader
          isNested={isNested}
          isTrigger={isTrigger}
          onModalOpen={handleProceed}
        />
      ) : !selectedActionOrTrigger ? (
        // GUARDRAIL: this only shows when the selected app is not found
        <ErrorFlowStepHeader isNested={isNested} step={step} />
      ) : (
        <Flex flexDir="row" w="100%">
          <Flex
            alignItems={isNested ? 'flex-start' : 'center'}
            justifyContent="center"
            flexDir="column"
            flex={nestedHandleOffset ? undefined : '1'}
            // Without flexShrink={0}, default flex-shrink would claw the
            // margin nudge back out of this box's width instead of shifting
            // its position.
            flexShrink={nestedHandleOffset ? 0 : undefined}
            w={
              nestedHandleOffset
                ? `calc(100% - ${NESTED_DRAG_HANDLE_WIDTH}px)`
                : undefined
            }
            ml={nestedHandleOffset ? `${nestedHandleOffset}px` : undefined}
            minW="0"
          >
            {showMrfReadOnlyNote && (
              <Box
                borderColor={
                  shouldHighlight ? 'base.content.brand' : 'base.divider.medium'
                }
                borderRadius="lg"
                borderWidth="1px"
                borderBottomRadius="none"
                borderBottomWidth={0}
                w={headerWidth}
              >
                <Infobox
                  icon={<BiInfoCircle />}
                  variant="secondary"
                  style={{
                    borderBottomLeftRadius: '0',
                    borderBottomRightRadius: '0',
                  }}
                >
                  These steps are based on your form in FormSG. Plumber only
                  reads your form and never makes changes to it.
                </Infobox>
              </Box>
            )}
            {warnsMrfNoGate && (
              <Box
                borderColor={
                  shouldHighlight ? 'base.content.brand' : 'base.divider.medium'
                }
                borderRadius="lg"
                borderWidth="1px"
                borderBottomRadius="none"
                borderBottomWidth={0}
                w={headerWidth}
                overflow="hidden"
              >
                <Infobox
                  icon={<BiSolidErrorCircle />}
                  variant="warning"
                  style={{
                    borderBottomLeftRadius: '0',
                    borderBottomRightRadius: '0',
                  }}
                >
                  This won&rsquo;t stop the next respondent. FormSG still sends
                  them the form. &ldquo;Only continue if&rdquo; only skips the
                  Plumber steps below.
                </Infobox>
              </Box>
            )}
            {shouldTestStepAgain && (
              <TestAgainInfobox
                isNested={isNested}
                shouldHighlight={shouldHighlight}
              />
            )}
            {shouldShowTemplateMsg && (
              <Box
                borderColor={
                  shouldHighlight ? 'base.content.brand' : 'base.divider.medium'
                }
                borderRadius="lg"
                borderWidth="1px"
                borderBottomRadius="none"
                borderBottomWidth={0}
                w={headerWidth}
              >
                <Infobox
                  icon={<BiInfoCircle />}
                  variant="secondary"
                  style={{
                    borderBottomLeftRadius: '0',
                    borderBottomRightRadius: '0',
                  }}
                >
                  <MarkdownRenderer
                    source={templateStepHelpMessage}
                    components={infoboxMdComponents}
                  />
                </Infobox>
              </Box>
            )}
            <Flex
              flexDir="column"
              data-test="flow-step"
              {...flowStepStyles.container}
              justifyContent="flex-start"
              borderTopWidth={hasInfoBox ? 0 : '1px'}
              borderColor={
                shouldHighlight ? 'base.content.brand' : 'base.divider.medium'
              }
              borderTopRadius={hasInfoBox ? 'none' : 'lg'}
              h={
                isNested
                  ? NESTED_FLOW_STEP_HEIGHT
                  : isApprovalStep
                    ? undefined
                    : '64px'
              }
              minH={isApprovalStep && !isNested ? '124px' : undefined}
              w={headerWidth}
              onClick={isClickable ? handleClick : undefined}
              {...(!isClickable && { cursor: 'default', _hover: {} })}
              {...containerHeaderStyles}
            >
              <Flex {...flowStepStyles.topHeader}>
                <StepAppIcon
                  // The container header stands in for the whole block; its
                  // own condition step being "complete" doesn't mean the
                  // block is, so it never shows the checkmark badge.
                  isCompleted={isContainerHeader ? false : isCompleted}
                  isNested={isNested}
                  isTestSuccessful={isTestSuccessful}
                  shouldTestStepAgain={shouldTestStepAgain}
                  app={app}
                  step={step}
                />
                <StepNameAndDemo
                  displayPosition={
                    hideDisplayPosition ? undefined : displayPosition
                  }
                  stepName={stepName}
                />
                {isDeletable && (
                  <Flex gap={1} ml="auto">
                    {!isTrigger && (
                      <DuplicateStepButton isNested={isNested} step={step} />
                    )}
                    <DeleteStepButton
                      isNested={isNested}
                      step={step}
                      displayPosition={
                        hideDisplayPosition ? undefined : displayPosition
                      }
                      stepName={stepName}
                    />
                  </Flex>
                )}
              </Flex>
              {isApprovalStep && <ApproveReject stepId={step.id} />}
            </Flex>
          </Flex>
          {shouldShowDragHandle &&
            (isNested ? (
              <DragHandle isNested={isNested} onWarningOpen={onWarningOpen} />
            ) : (
              <Box position="absolute" left="100%" alignSelf="center">
                <DragHandle onWarningOpen={onWarningOpen} />
              </Box>
            ))}
        </Flex>
      )}
      {isModalOpen && (
        <FlowStepConfigurationModal
          onClose={onModalClose}
          isTrigger={isTrigger}
          isLastStep={isLastStep}
          step={step}
          app={app}
          event={selectedActionOrTrigger}
        />
      )}

      <UnsavedChangesAlert
        cancelRef={cancelRef}
        isOpen={isWarningOpen}
        onClose={onWarningClose}
        onLeave={onLeave}
      />
    </FlowStepWrapper>
  )
}
