import { IBaseTrigger, IStep, ITriggerInstructions } from '@plumber/types'

import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { BiChevronDown, BiChevronUp } from 'react-icons/bi'
import {
  Box,
  Grid,
  GridItem,
  HStack,
  Text,
  Tooltip,
  useDisclosure,
  VStack,
} from '@chakra-ui/react'
import { Button, Infobox } from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'
import { validateStepParams } from '@/helpers/validateStepParams'
import { useStepMetadata } from '@/hooks/useStepMetadata'

import { EDITOR_MARGIN_TOP_NUM } from '../Editor/constants'
import ErrorResult from '../ErrorResult'
import WebhookUrlInfo from '../WebhookUrlInfo'

import { isMultiRowStep } from './multiRowResultUtils'
import { flowStepTestControllerStyles } from './styles'
import TestMultiRowResultModal from './TestMultiRowResultModal'
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
  isReadOnly: boolean
  hasDeletedVars?: boolean
  children: React.ReactNode
}

const CheckStepTooltip = (props: CheckStepTooltipProps) => {
  const { children, hasDeletedVars, isDisabled, isReadOnly } = props
  return (
    <Tooltip
      label={
        isReadOnly
          ? 'Unpublish your pipe to check step'
          : hasDeletedVars
          ? 'Remove variables from deleted steps to check step'
          : 'Complete required fields to check step'
      }
      aria-label="check step tooltip"
      isDisabled={isDisabled}
      hasArrow
    >
      {children}
    </Tooltip>
  )
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
    isMobile,
    isTestExecuting,
    testExecutionSteps,
    varInfoMap,
  } = useContext(EditorContext)
  const {
    isOpen: isModalOpen,
    onOpen: onModalOpen,
    onClose: onModalClose,
  } = useDisclosure()
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

  // isLastTestExecutionCurrent is used to determine if the last test execution corresponds
  // to the values in the form.
  // isLastTestExecutionCurrent is false if the form values are saved but not tested
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
    !readOnly && (!isLastTestExecutionCurrent || (isTestSuccessful && isDirty))
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
        isDisabled={isValid && !readOnly}
        isReadOnly={readOnly}
      >
        <Button
          variant={
            infoBoxVariant === 'unstyled'
              ? undefined
              : isMobile
              ? 'outline'
              : 'clear'
          }
          onClick={handleSaveAndTest}
          isLoading={isTestExecuting}
          colorScheme={infoBoxVariant === 'unstyled' ? 'primary' : 'black'}
          size="sm"
          isDisabled={!isValid || readOnly}
        >
          <Text noOfLines={1}>Check step again</Text>
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
      isMobile,
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
      <VStack
        {...flowStepTestControllerStyles.container}
        ref={containerRef}
        w="100%"
      >
        {shouldShowTestResults ? (
          <VStack w="100%">
            <HStack w="100%">
              <Infobox
                {...flowStepTestControllerStyles.testedInfobox}
                variant={infoBoxVariant}
                borderBottomRadius={isTestResultOpen ? 0 : undefined}
                icon={infoBoxVariant === 'unstyled' ? <></> : null}
              >
                <Grid
                  justifyContent="space-between"
                  alignItems="center"
                  w="100%"
                  templateAreas={{
                    base: `
                      "test-result"
                      "save-button"
                      "check-button"
                    `,
                    md: `"test-result save-button check-button"`,
                  }}
                  gridTemplateColumns={{
                    base: '1fr',
                    md: '1fr auto auto',
                  }}
                  rowGap={2}
                >
                  <GridItem area="test-result">
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
                        <Text
                          color="base.content.default"
                          noOfLines={1}
                          textAlign="left"
                        >
                          {infoBoxText}
                        </Text>
                        {!isTestExecuting && (
                          <Box ml={2} color="base.content.default">
                            {getChevronIcon()}
                          </Box>
                        )}
                      </Button>
                    )}
                  </GridItem>
                  {shouldShowSaveButton ? (
                    <>
                      <GridItem area="save-button">
                        <Button
                          variant={isMobile ? 'outline' : 'clear'}
                          size="sm"
                          colorScheme="black"
                          onClick={handleSave}
                          isDisabled={!isDirty}
                          mr={2}
                        >
                          <Text noOfLines={1}>
                            {!isDirty ? 'Saved' : 'Save without checking'}
                          </Text>
                        </Button>
                      </GridItem>
                      <GridItem area="check-button">
                        {CheckAgainButton}
                      </GridItem>
                    </>
                  ) : (
                    <GridItem area="check-button">{CheckAgainButton}</GridItem>
                  )}
                </Grid>
              </Infobox>
            </HStack>
            <TestResult
              step={step}
              selectedActionOrTrigger={selectedActionOrTrigger}
              variables={testVariables}
              isMock={currentTestExecutionStep?.metadata?.isMock}
              isOpen={isTestResultOpen}
              isIfThenStep={isIfThenStep}
              onModalOpen={onModalOpen}
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
              <CheckStepTooltip
                hasDeletedVars={hasDeletedVars}
                isDisabled={shouldAllowCheckStep}
                isReadOnly={readOnly}
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
      {isMultiRowStep(step) && (
        <TestMultiRowResultModal
          isOpen={isModalOpen}
          onClose={onModalClose}
          currentExecutionStep={currentTestExecutionStep}
        />
      )}
    </>
  )
}
