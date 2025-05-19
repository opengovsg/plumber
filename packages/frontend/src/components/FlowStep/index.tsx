import type { IStep } from '@plumber/types'

import { useCallback, useContext, useMemo } from 'react'
import { BiInfoCircle } from 'react-icons/bi'
import { Box, CircularProgress, Flex, useDisclosure } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'
import { StepDisplayOverridesContext } from '@/contexts/StepDisplayOverrides'
import { MarkdownRenderer } from '@/exports/components'
import { getFlowStepHeaderWidth } from '@/helpers/editor'
import { replacePlaceholdersForHelpMessage } from '@/helpers/flow-templates'
import { validateStepParams } from '@/helpers/validateStepParams'
import { useStepMetadata } from '@/hooks/useStepMetadata'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

import UnsavedChangesAlert from '../Editor/UnsavedChangesAlert'
import EmptyFlowStepHeader from '../EmptyFlowStepHeader'
import FlowStepConfigurationModal from '../FlowStepConfigurationModal'
import { infoboxMdComponents } from '../MarkdownRenderer/CustomMarkdownComponents'

import StepAppIcon from './components/StepAppIcon'
import StepCaptionAndDemo from './components/StepCaptionAndDemo'
import StepDeleteButton from './components/StepDeleteButton'
import TestAgainInfobox from './components/TestAgainInfobox'
import FlowStepWrapper from './FlowStepWrapper'
import { flowStepStyles } from './styles'

type FlowStepProps = {
  step: IStep
  index: number
  isDeletable?: boolean
  isLastStep: boolean
  isNested?: boolean
}

export default function FlowStep(
  props: FlowStepProps,
): React.ReactElement | null {
  const { step, index, isLastStep, isNested } = props

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
    setCurrentStepIndex,
    setShouldWarnOnLeave,
  } = useContext(EditorContext)
  const displayOverrides = useContext(StepDisplayOverridesContext)?.[step.id]
  const { app, caption, isCompleted, isTrigger, selectedActionOrTrigger } =
    useStepMetadata(allApps, step)

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

  const isDeletable =
    displayOverrides?.disableDelete === true
      ? false
      : !readOnly && props.isDeletable

  const { shouldTestStepAgain, isTestSuccessful } = useMemo(
    () => validateStepParams(step, testExecutionSteps),
    [step, testExecutionSteps],
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
      setCurrentStepIndex(null)
      onDrawerClose()
    } else {
      setCurrentStepId(step.id)
      setCurrentStepIndex(index)
      onDrawerOpen()
    }
  }, [
    app,
    currentStepId,
    index,
    isDrawerOpen,
    shouldWarnOnLeave,
    step.id,
    onDrawerClose,
    onDrawerOpen,
    onModalOpen,
    onWarningOpen,
    setCurrentStepId,
    setCurrentStepIndex,
  ])

  const onLeave = () => {
    if (currentStepId === step.id) {
      setCurrentStepId(null)
      setCurrentStepIndex(null)
      setShouldWarnOnLeave(false)
      onDrawerClose()
    } else if (!app || !selectedActionOrTrigger) {
      setShouldWarnOnLeave(false)
      discardChanges()
    } else {
      setCurrentStepId(step.id)
      setCurrentStepIndex(index)
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
    <FlowStepWrapper>
      {!app || !selectedActionOrTrigger ? (
        <EmptyFlowStepHeader
          isNested={isNested}
          isTrigger={isTrigger}
          onModalOpen={handleProceed}
        />
      ) : (
        <>
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
            {...flowStepStyles.container}
            borderTopWidth={hasInfoBox ? 0 : '1px'}
            borderColor={
              shouldHighlight ? 'base.content.brand' : 'base.divider.medium'
            }
            borderTopRadius={hasInfoBox ? 'none' : 'lg'}
            h={isNested ? '48px' : '64px'}
            w={headerWidth}
          >
            <Flex
              {...flowStepStyles.topHeader}
              py={isNested ? 2 : 4}
              onClick={handleClick}
            >
              <StepAppIcon
                isCompleted={isCompleted}
                isNested={isNested}
                isTestSuccessful={isTestSuccessful}
                shouldTestStepAgain={shouldTestStepAgain}
                app={app}
                step={step}
              />
              <StepCaptionAndDemo app={app} caption={caption} />
              {isDeletable && (
                <StepDeleteButton isNested={isNested} step={step} />
              )}
            </Flex>
          </Flex>
        </>
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
