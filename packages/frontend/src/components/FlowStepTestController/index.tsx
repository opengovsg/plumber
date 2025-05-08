import { IBaseTrigger, IStep, ITriggerInstructions } from '@plumber/types'

import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { BiChevronDown, BiChevronUp } from 'react-icons/bi'
import { Box, Flex, HStack, Stack, Text, VStack } from '@chakra-ui/react'
import { Button, Infobox } from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'
import { useStepMetadata } from '@/hooks/useStepMetadata'

import ErrorResult from '../ErrorResult'
import WebhookUrlInfo from '../WebhookUrlInfo'

import { flowStepTestControllerStyles } from './styles'
import TestResult from './TestResult'
import { useTestDetails } from './useTestDetails'
import { getInfoBoxDetails, matchParamsToDataIn } from './utils'

const defaultTriggerInstructions: ITriggerInstructions = {
  beforeUrlMsg: `# 1. You'll need to configure your application with this webhook URL.`,
  afterUrlMsg: `# 2. Send some data to the webhook URL after configuration. Then, click check step.`,
}

interface FlowStepTestControllerProps {
  isDirty: boolean
  isSaving: boolean
  isTestResultOpen: boolean
  isValid: boolean
  step: IStep
  handleSave: () => void
  handleSaveAndTest: () => void
  onTestResultOpen: () => void
  onTestResultClose: () => void
}

export default function FlowStepTestController(
  props: FlowStepTestControllerProps,
) {
  const {
    isDirty,
    isSaving,
    isTestResultOpen,
    isValid,
    step,
    handleSave,
    handleSaveAndTest,
    onTestResultOpen,
    onTestResultClose,
  } = props
  const {
    allApps,
    currentTestExecutionStep,
    readOnly,
    isTestExecuting,
    varInfoMap,
  } = useContext(EditorContext)
  const formContext = useFormContext()

  const { isIfThenStep, isTrigger, selectedActionOrTrigger } = useStepMetadata(
    allApps,
    step,
  )
  const {
    isTestSuccessful,
    lastErrorDetails,
    isWebhookSubstep,
    testVariables,
  } = useTestDetails(step, currentTestExecutionStep)
  const containerRef = useRef<HTMLDivElement>(null)
  const [collapseDirection, setCollapseDirection] = useState<'up' | 'down'>(
    'down',
  )

  const isLastTestExecutionCurrent = useMemo(() => {
    const formValues = formContext.getValues()
    return matchParamsToDataIn(
      currentTestExecutionStep?.dataIn,
      formValues.parameters,
      varInfoMap,
    )
  }, [currentTestExecutionStep, formContext, varInfoMap])

  const [infoBoxVariant, infoBoxText] = getInfoBoxDetails({
    isDirty,
    isIfThenStep,
    isLastTestExecutionCurrent,
    isTestSuccessful,
    stepId: step.id,
    testVariables,
  })

  const shouldShowSaveButton =
    !isLastTestExecutionCurrent || (isTestSuccessful && isDirty)
  const shouldShowTestResults = currentTestExecutionStep && !lastErrorDetails

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const updateCollapseDirection = () => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) {
        return
      }

      // Get the content height from the test variables
      const contentHeight = testVariables?.length
        ? testVariables.length * 40
        : 0
      const minContentHeight = 108 // Minimum height to consider for content

      const spaceBelow = window.innerHeight - 61 - rect.bottom
      const spaceAbove = rect.top + 61 + 32

      if (isTrigger) {
        setCollapseDirection('down')
        return
      }

      if (contentHeight < minContentHeight) {
        setCollapseDirection('down')

        if (spaceBelow < 0) {
          setCollapseDirection('up')
          return
        }
        return
      }

      if (spaceBelow < 0) {
        setCollapseDirection('up')
        return
      }

      setCollapseDirection(spaceAbove > spaceBelow ? 'up' : 'down')
    }

    updateCollapseDirection()
    window.addEventListener('resize', updateCollapseDirection)
    window.addEventListener('scroll', updateCollapseDirection)

    return () => {
      window.removeEventListener('resize', updateCollapseDirection)
      window.removeEventListener('scroll', updateCollapseDirection)
    }
  }, [isTrigger, testVariables])

  const getChevronIcon = () => {
    if (isTestResultOpen) {
      return collapseDirection === 'up' ? <BiChevronDown /> : <BiChevronUp />
    }
    return collapseDirection === 'up' ? <BiChevronUp /> : <BiChevronDown />
  }

  const CheckAgainButton = useMemo(
    () => (
      <Button
        variant={infoBoxVariant === 'unstyled' ? undefined : 'clear'}
        onClick={handleSaveAndTest}
        isLoading={isTestExecuting}
        colorScheme={infoBoxVariant === 'unstyled' ? 'primary' : 'black'}
        size="sm"
        isDisabled={!isValid}
      >
        Check step again
      </Button>
    ),
    [handleSaveAndTest, infoBoxVariant, isTestExecuting, isValid],
  )

  return (
    <Stack {...flowStepTestControllerStyles.container} ref={containerRef}>
      <VStack w="100%">
        {isWebhookSubstep && (
          <VStack w="100%">
            <WebhookUrlInfo
              webhookUrl={step.webhookUrl}
              webhookTriggerInstructions={
                (selectedActionOrTrigger as IBaseTrigger)
                  .webhookTriggerInstructions || defaultTriggerInstructions
              }
              sx={{ mb: 2 }}
            />
          </VStack>
        )}
        {shouldShowTestResults ? (
          <VStack w="100%">
            <HStack w="100%">
              <Infobox
                {...flowStepTestControllerStyles.testedInfobox}
                variant={infoBoxVariant}
                borderBottomRadius={isTestResultOpen ? 0 : undefined}
                icon={infoBoxVariant === 'unstyled' ? <></> : null}
              >
                <Flex
                  justifyContent="space-between"
                  alignItems="center"
                  w="100%"
                >
                  {isIfThenStep ? (
                    // NOTE: special handling for If-then
                    // do not need button as there are no variables to display
                    <Text>{infoBoxText}</Text>
                  ) : (
                    <Button
                      variant="clear"
                      colorScheme={
                        infoBoxVariant === 'unstyled' ? 'primary' : 'green'
                      }
                      size="sm"
                      onClick={() =>
                        isTestResultOpen
                          ? onTestResultClose()
                          : onTestResultOpen()
                      }
                    >
                      <Text color="base.content.default">{infoBoxText}</Text>
                      <Box ml={2} color="base.content.default">
                        {getChevronIcon()}
                      </Box>
                    </Button>
                  )}
                  {shouldShowSaveButton ? (
                    <Flex gap={2}>
                      <Button
                        variant="clear"
                        size="sm"
                        colorScheme="black"
                        onClick={handleSave}
                        isDisabled={!isLastTestExecutionCurrent && !isDirty}
                      >
                        {!isLastTestExecutionCurrent && !isDirty
                          ? 'Saved'
                          : 'Save without checking'}
                      </Button>
                      {CheckAgainButton}
                    </Flex>
                  ) : (
                    CheckAgainButton
                  )}
                </Flex>
              </Infobox>
            </HStack>
            <TestResult
              step={step}
              selectedActionOrTrigger={selectedActionOrTrigger}
              variables={testVariables}
              isMock={currentTestExecutionStep?.metadata?.isMock}
              isOpen={isTestResultOpen}
            />
          </VStack>
        ) : (
          <VStack w="100%" gap={2}>
            {lastErrorDetails && (
              <Box w="100%">
                <ErrorResult errorDetails={lastErrorDetails} isTestRun={true} />
              </Box>
            )}
            <HStack w="100%" justifyContent="flex-end">
              {!step.webhookUrl && (
                <Button
                  isDisabled={readOnly || isSaving || !isDirty}
                  isLoading={isSaving}
                  variant="clear"
                  onClick={handleSave}
                >
                  {isDirty ? 'Save' : 'Saved'}
                </Button>
              )}
              <Button
                onClick={handleSaveAndTest}
                data-test="flow-substep-continue-button"
                isDisabled={!isValid || readOnly || isSaving}
                isLoading={isTestExecuting}
              >
                Check step
              </Button>
            </HStack>
          </VStack>
        )}
      </VStack>
    </Stack>
  )
}
