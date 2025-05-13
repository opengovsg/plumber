import { IBaseTrigger, IStep, ITriggerInstructions } from '@plumber/types'

import { useContext, useMemo } from 'react'
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
import { matchParamsToDataIn } from './utils'

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

  const { selectedActionOrTrigger } = useStepMetadata(allApps, step)
  const {
    isTestSuccessful,
    lastErrorDetails,
    isWebhookSubstep,
    testVariables,
  } = useTestDetails(step, currentTestExecutionStep)

  const isLastTestExecutionCurrent = useMemo(() => {
    const formValues = formContext.getValues()
    return matchParamsToDataIn(
      currentTestExecutionStep?.dataIn,
      formValues.parameters,
      varInfoMap,
    )
  }, [currentTestExecutionStep, formContext, varInfoMap])

  const CheckAgainButton = useMemo(
    () => (
      <Button
        variant="clear"
        onClick={handleSaveAndTest}
        isLoading={isTestExecuting}
        colorScheme="black"
        size="sm"
        isDisabled={!isValid}
      >
        Check step again
      </Button>
    ),
    [handleSaveAndTest, isTestExecuting, isValid],
  )

  const [infoBoxVariant, infoBoxText] = useMemo(() => {
    if (!isLastTestExecutionCurrent || (isTestSuccessful && isDirty)) {
      return ['warning', 'Previous result']
    }

    if (isTestSuccessful) {
      return ['success', 'Step was set up successfully!']
    }

    return ['error', 'Failed to set up step']
  }, [isLastTestExecutionCurrent, isTestSuccessful, isDirty])

  const shouldShowSaveButton = useMemo(
    () => !isLastTestExecutionCurrent || (isTestSuccessful && isDirty),
    [isLastTestExecutionCurrent, isTestSuccessful, isDirty],
  )

  const shouldShowTestResults = useMemo(
    () => currentTestExecutionStep && !lastErrorDetails,
    [currentTestExecutionStep, lastErrorDetails],
  )

  return (
    <Stack {...flowStepTestControllerStyles.container}>
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
                variant={infoBoxVariant}
                borderBottomRadius={isTestResultOpen ? 0 : undefined}
                {...flowStepTestControllerStyles.testedInfobox}
              >
                <Flex
                  justifyContent="space-between"
                  alignItems="center"
                  w="100%"
                >
                  <Flex
                    alignItems="center"
                    onClick={() =>
                      isTestResultOpen
                        ? onTestResultClose()
                        : onTestResultOpen()
                    }
                    cursor="pointer"
                  >
                    <Text>{infoBoxText}</Text>
                    <Box ml={2}>
                      {isTestResultOpen ? <BiChevronDown /> : <BiChevronUp />}
                    </Box>
                  </Flex>
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
