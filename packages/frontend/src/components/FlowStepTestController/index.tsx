import { IBaseTrigger, IStep, ITriggerInstructions } from '@plumber/types'

import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { BiChevronDown, BiChevronUp } from 'react-icons/bi'
import {
  Box,
  Flex,
  HStack,
  Stack,
  Text,
  Tooltip,
  VStack,
} from '@chakra-ui/react'
import { Button, Infobox } from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'
import { validateStepParams } from '@/helpers/validateStepParams'
import { useStepMetadata } from '@/hooks/useStepMetadata'

import { EDITOR_MARGIN_TOP_NUM } from '../Editor/constants'
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
  hasDeletedVars: boolean
  handleSave: () => void
  handleSaveAndTest: () => void
  onTestResultOpen: () => void
  onTestResultClose: () => void
}

type CheckStepTooltipProps = {
  isDisabled: boolean
  hasDeletedVars?: boolean
  children: React.ReactNode
}

const CheckStepTooltip = (props: CheckStepTooltipProps) => (
  <Tooltip
    label={
      props.hasDeletedVars
        ? 'Remove variables from deleted steps to check step'
        : 'Complete required fields to check step'
    }
    aria-label="check step tooltip"
    isDisabled={props.isDisabled}
    hasArrow
  >
    {props.children}
  </Tooltip>
)

export default function FlowStepTestController(
  props: FlowStepTestControllerProps,
) {
  const {
    isDirty,
    isSaving,
    isTestResultOpen,
    isValid,
    step,
    hasDeletedVars,
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
    testExecutionSteps,
    varInfoMap,
  } = useContext(EditorContext)
  const formContext = useFormContext()

  const { isIfThenStep, isTrigger, selectedActionOrTrigger, substeps } =
    useStepMetadata(allApps, step)
  const {
    isTestSuccessful,
    lastErrorDetails,
    isWebhookSubstep,
    testVariables,
  } = useTestDetails(step, currentTestExecutionStep)
  const containerRef = useRef<HTMLDivElement>(null)
  const webhookUrlInfoRef = useRef<HTMLDivElement>(null)
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
    isTestExecuting,
    stepId: step.id,
    testVariables,
  })

  const { shouldTestStepAgain } = useMemo(() => {
    return validateStepParams(step, testExecutionSteps, substeps)
  }, [testExecutionSteps, step, substeps])

  const shouldAllowCheckStep = isValid && !readOnly && !isSaving
  const shouldShowSaveButton =
    !isLastTestExecutionCurrent || (isTestSuccessful && isDirty)
  const shouldShowTestResults =
    currentTestExecutionStep && !lastErrorDetails && !shouldTestStepAgain

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const updateCollapseDirection = () => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) {
        return
      }

      const contentHeight = testVariables?.length
        ? testVariables.length * 40
        : 0
      const minContentHeight = 108

      const spaceBelow =
        window.innerHeight - EDITOR_MARGIN_TOP_NUM - rect.bottom
      const spaceAbove = rect.top + EDITOR_MARGIN_TOP_NUM + 32

      // NOTE: all current triggers have a small number of fields
      if (isTrigger) {
        setCollapseDirection('down')
        return
      }

      if (contentHeight < minContentHeight) {
        setCollapseDirection('down')
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
      <CheckStepTooltip
        hasDeletedVars={hasDeletedVars}
        isDisabled={!(!isValid || readOnly)}
      >
        <Button
          variant={infoBoxVariant === 'unstyled' ? undefined : 'clear'}
          onClick={handleSaveAndTest}
          isLoading={isTestExecuting}
          colorScheme={infoBoxVariant === 'unstyled' ? 'primary' : 'black'}
          size="sm"
          isDisabled={!isValid || readOnly}
        >
          Check step again
        </Button>
      </CheckStepTooltip>
    ),
    [
      handleSaveAndTest,
      hasDeletedVars,
      infoBoxVariant,
      isTestExecuting,
      isValid,
      readOnly,
    ],
  )

  return (
    <>
      {isWebhookSubstep && (
        <VStack w="100%" ref={webhookUrlInfoRef}>
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
      <Stack {...flowStepTestControllerStyles.container} ref={containerRef}>
        <VStack w="100%">
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
                    {isIfThenStep && isLastTestExecutionCurrent ? (
                      // NOTE: special handling for If-then
                      // do not need button as there are no variables to display
                      <Text>{infoBoxText}</Text>
                    ) : (
                      <Button
                        variant="clear"
                        colorScheme={
                          infoBoxVariant === 'unstyled' ? 'black' : 'green'
                        }
                        px={2}
                        ml={infoBoxVariant === 'unstyled' ? -1 : -0.5}
                        size="sm"
                        onClick={() =>
                          isTestResultOpen
                            ? onTestResultClose()
                            : onTestResultOpen()
                        }
                        isDisabled={isTestExecuting}
                      >
                        <Text color="base.content.default">{infoBoxText}</Text>
                        {!isTestExecuting && (
                          <Box ml={2} color="base.content.default">
                            {getChevronIcon()}
                          </Box>
                        )}
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
                isIfThenStep={isIfThenStep}
              />
            </VStack>
          ) : (
            <VStack w="100%" gap={2}>
              {lastErrorDetails && (
                <Box w="100%">
                  <ErrorResult
                    errorDetails={lastErrorDetails}
                    isTestRun={true}
                  />
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
                <CheckStepTooltip
                  hasDeletedVars={hasDeletedVars}
                  isDisabled={shouldAllowCheckStep}
                >
                  <Button
                    onClick={handleSaveAndTest}
                    data-test="flow-substep-continue-button"
                    isDisabled={!shouldAllowCheckStep}
                    isLoading={isTestExecuting}
                  >
                    Check step
                  </Button>
                </CheckStepTooltip>
              </HStack>
            </VStack>
          )}
        </VStack>
      </Stack>
    </>
  )
}
