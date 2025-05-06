import type { IFlow, IStep } from '@plumber/types'

import { useCallback, useContext, useMemo } from 'react'
import { BiInfoCircle } from 'react-icons/bi'
import { Box, CircularProgress, Flex, useDisclosure } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'
import { StepDisplayOverridesContext } from '@/contexts/StepDisplayOverrides'
import { MarkdownRenderer } from '@/exports/components'
import { getFlowStepHeaderWidth } from '@/helpers/editor'
import { replacePlaceholdersForHelpMessage } from '@/helpers/flow-templates'
import { useStepMetadata } from '@/hooks/useStepMetadata'

import EmptyFlowStepHeader from '../EmptyFlowStepHeader'
import FlowStepConfigurationModal from '../FlowStepConfigurationModal'
import { matchParamsToDataIn } from '../FlowStepTestController/utils'
import { infoboxMdComponents } from '../MarkdownRenderer/CustomMarkdownComponents'

import StepAppIcon from './components/StepAppIcon'
import StepCaptionAndDemo from './components/StepCaptionAndDemo'
import StepDeleteButton from './components/StepDeleteButton'
import TestAgainInfobox from './components/TestAgainInfobox'
import FlowStepWrapper from './FlowStepWrapper'
import { flowStepStyles } from './styles'

type FlowStepProps = {
  flow: IFlow
  step: IStep
  isDeletable?: boolean
  isLastStep: boolean
  isNested?: boolean
  onOpen: () => void
  onClose: () => void
}

export default function FlowStep(
  props: FlowStepProps,
): React.ReactElement | null {
  const { flow, step, isLastStep, isNested, onOpen, onClose } = props

  const {
    isOpen: isModalOpen,
    onOpen: onModalOpen,
    onClose: onModalClose,
  } = useDisclosure()

  const {
    allApps,
    currentStepId,
    isDrawerOpen,
    isMobile,
    readOnly,
    testExecutionSteps,
    varInfoMap,
  } = useContext(EditorContext)
  const displayOverrides = useContext(StepDisplayOverridesContext)?.[step.id]
  const { app, caption, isCompleted, isTrigger, selectedActionOrTrigger } =
    useStepMetadata(allApps, step)

  const isDeletable =
    displayOverrides?.disableDelete === true
      ? false
      : !readOnly && props.isDeletable

  const { shouldTestStepAgain, isTestSuccessful } = useMemo(() => {
    const testResult = testExecutionSteps.find((ts) => ts.stepId === step.id)
    if (!testResult) {
      return {
        shouldTestStepAgain: false,
        isTestSuccessful: testResult,
      }
    }
    return {
      shouldTestStepAgain: !matchParamsToDataIn(
        testResult?.dataIn,
        step.parameters,
        varInfoMap,
      ),
      isTestSuccessful: testResult.status === 'success',
    }
  }, [testExecutionSteps, step, varInfoMap])

  const shouldHighlight = currentStepId === step.id

  const handleClick = useCallback(() => {
    if (!app) {
      onModalOpen()
      return
    }
    if (isDrawerOpen && currentStepId === step.id) {
      onClose()
    } else {
      onOpen()
    }
  }, [app, isDrawerOpen, currentStepId, step.id, onModalOpen, onClose, onOpen])

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
  const hasInfoBox = shouldTestStepAgain || shouldShowTemplateMsg

  if (!allApps) {
    return <CircularProgress isIndeterminate my={2} />
  }

  return (
    <FlowStepWrapper>
      {!app || !selectedActionOrTrigger ? (
        <EmptyFlowStepHeader
          isNested={isNested}
          isTrigger={isTrigger}
          onModalOpen={onModalOpen}
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
              />
              <StepCaptionAndDemo app={app} caption={caption} />
              {isDeletable && (
                <StepDeleteButton
                  isNested={isNested}
                  onClose={onClose}
                  step={step}
                />
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
    </FlowStepWrapper>
  )
}
