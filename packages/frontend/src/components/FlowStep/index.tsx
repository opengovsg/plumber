import type { IStep } from '@plumber/types'

import { useCallback, useContext, useMemo } from 'react'
import { BiInfoCircle } from 'react-icons/bi'
import { Box, CircularProgress, Flex, useDisclosure } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'

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

import DeleteStepButton from './components/DeleteStepButton'
import DuplicateStepButton from './components/DuplicateStepButton'
import StepAppIcon from './components/StepAppIcon'
import StepNameAndDemo from './components/StepNameAndDemo'
import TestAgainInfobox from './components/TestAgainInfobox'
import FlowStepWrapper from './FlowStepWrapper'
import { flowStepStyles } from './styles'

type FlowStepProps = {
  step: IStep
  isLastStep: boolean
  isNested?: boolean
  allowReorder?: boolean
  // we use this to control the width of condition steps in if-then and for-each
  canChildStepsReorder?: boolean
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
  } = props

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
    stepName,
    displayPosition,
    isCompleted,
    isTrigger,
    selectedActionOrTrigger,
    substeps,
    shouldShowDragHandle,
    isDeletable,
  } = useStepMetadata(step, allowReorder)

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

  // generate help message only if template config exists
  const stepAppEventKey = `${step?.appKey}_${step?.key}`
  const templateStepAppEventKey = step.config.templateConfig?.appEventKey
  const templateStepHelpMessage = replacePlaceholdersForHelpMessage(
    templateStepAppEventKey,
    flow?.config?.templateConfig,
  )

  // Only show if the template step app key matches the current step app key
  // and has a help message (once tested successfully, the template step app key is removed)
  const shouldShowTemplateMsg: boolean =
    stepAppEventKey === templateStepAppEventKey && !!templateStepHelpMessage

  // NOTE: there will only be 1 infobox shown at a time
  // there will not be a situation where both are shown as template messages
  // are removed once user executes a successful test
  const hasInfoBox = shouldShowTemplateMsg || shouldTestStepAgain

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
            flex="1"
            minW="0"
          >
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
              data-test="flow-step"
              {...flowStepStyles.container}
              borderTopWidth={hasInfoBox ? 0 : '1px'}
              borderColor={
                shouldHighlight ? 'base.content.brand' : 'base.divider.medium'
              }
              borderTopRadius={hasInfoBox ? 'none' : 'lg'}
              h={isNested ? '48px' : '64px'}
              w={headerWidth}
            >
              <Flex {...flowStepStyles.topHeader} onClick={handleClick}>
                <StepAppIcon
                  isCompleted={isCompleted}
                  isNested={isNested}
                  isTestSuccessful={isTestSuccessful}
                  shouldTestStepAgain={shouldTestStepAgain}
                  app={app}
                  step={step}
                />
                <StepNameAndDemo
                  displayPosition={displayPosition}
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
                      displayPosition={displayPosition}
                      stepName={stepName}
                    />
                  </Flex>
                )}
              </Flex>
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
