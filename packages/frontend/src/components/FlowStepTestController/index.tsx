import {
  IBaseTrigger,
  IStep,
  ITriggerInstructions,
  TFieldPreviewType,
} from '@plumber/types'

import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { BiChevronDown, BiChevronUp } from 'react-icons/bi'
import {
  Box,
  Flex,
  HStack,
  Icon,
  Text,
  Tooltip,
  useDisclosure,
  VStack,
} from '@chakra-ui/react'
import {
  Button,
  BxsCheckCircle,
  BxsErrorCircle,
  BxsInfoCircle,
  Infobox,
} from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'
import { validateStepParams } from '@/helpers/validateStepParams'
import { useStepMetadata } from '@/hooks/useStepMetadata'

import { EDITOR_MARGIN_TOP_NUM } from '../Editor/constants'
import EmailPreviewModal from '../EmailPreviewModal'
import ErrorResult from '../ErrorResult'
import { substituteForPreview } from '../RichTextEditor/utils'
import WebhookUrlInfo from '../WebhookUrlInfo'

import { CheckAgainButton } from './CheckAgainButton'
import { flowStepTestControllerStyles } from './styles'
import TestResult from './TestResult'
import { useTestDetails } from './useTestDetails'
import {
  getInfoBoxDetails,
  isSameAppAndAppKey,
  matchParamsToDataIn,
} from './utils'

const PREVIEW_BUTTON_COPY: Record<TFieldPreviewType, string> = {
  email: 'Preview email',
}

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
  handleSaveAndTest: (testRunMetadata?: Record<string, unknown>) => void
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
    isTestExecuting,
    testExecutionSteps,
    varInfoMap,
  } = useContext(EditorContext)
  const formContext = useFormContext()

  const {
    isIfThenStep,
    isTrigger,
    isMrfStep,
    selectedActionOrTrigger,
    substeps,
    isAiStep,
  } = useStepMetadata(step)

  const {
    isTestSuccessful,
    lastErrorDetails,
    isWebhookSubstep,
    testVariables,
    previewAction,
  } = useTestDetails(step, currentTestExecutionStep, allApps, substeps)

  const {
    isOpen: isPreviewModalOpen,
    onOpen: onPreviewModalOpen,
    onClose: onPreviewModalClose,
  } = useDisclosure()

  const previewModal = useMemo(() => {
    if (!previewAction) {
      return null
    }
    switch (previewAction.kind) {
      case 'email': {
        const previewHtml = substituteForPreview(previewAction.html, varInfoMap)
        return (
          <EmailPreviewModal
            isOpen={isPreviewModalOpen}
            onClose={onPreviewModalClose}
            html={previewHtml}
          />
        )
      }
    }
  }, [previewAction, varInfoMap, isPreviewModalOpen, onPreviewModalClose])

  const previewButton = previewAction ? (
    <Button
      variant="outline"
      colorScheme="black"
      size="sm"
      onClick={onPreviewModalOpen}
      mr={2}
      data-test={`preview-${previewAction.kind}-button`}
    >
      {PREVIEW_BUTTON_COPY[previewAction.kind]}
    </Button>
  ) : null
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
    isAiStep,
  })

  const infoBoxIcon = useMemo(() => {
    const props = {
      fontSize: '2xl',
      marginRight: 1,
      display: 'flex',
    }
    if (infoBoxVariant === 'unstyled') {
      return <></>
    }

    // NOTE: for any AI step, always show the warning info circle
    // put this after 'unstyled' so that the loading state does not show the warning icon
    if (isAiStep) {
      return <Icon as={BxsInfoCircle} color="yellow.100" {...props} />
    }

    if (infoBoxVariant === 'error') {
      return <Icon as={BxsErrorCircle} color="red.500" {...props} />
    }
    if (infoBoxVariant === 'success') {
      return <Icon as={BxsCheckCircle} color="green.500" {...props} />
    }
    return <Icon as={BxsInfoCircle} color="blue.500" {...props} />
  }, [infoBoxVariant, isAiStep])

  const isStepUnchecked = infoBoxVariant === 'unstyled'

  const { shouldTestStepAgain } = useMemo(() => {
    return validateStepParams(step, testExecutionSteps, substeps)
  }, [testExecutionSteps, step, substeps])

  const shouldAllowCheckStep = isValid && !readOnly && !isSaving

  const shouldShowSaveButton =
    !readOnly && (!isLastTestExecutionCurrent || (isTestSuccessful && isDirty))
  const shouldShowTestResults =
    isSameAppAndAppKey(step, currentTestExecutionStep) &&
    !lastErrorDetails &&
    !shouldTestStepAgain

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
            <Infobox
              position="relative"
              {...flowStepTestControllerStyles.testedInfobox}
              variant={infoBoxVariant}
              borderBottomRadius={isTestResultOpen ? 0 : undefined}
              icon={<></>}
            >
              <Flex
                justifyContent="space-between"
                alignItems={{ base: 'flex-start', lg: 'center' }}
                flexDirection={{ base: 'column', lg: 'row' }}
                gap={{ base: 2, lg: 1 }}
                flex={1}
                maxW="100%"
              >
                <Flex alignItems="center" flex={1}>
                  {infoBoxIcon}
                  {isIfThenStep && isLastTestExecutionCurrent ? (
                    // NOTE: special handling for If-then
                    // do not need button as there are no variables to display
                    <Text>{infoBoxText}</Text>
                  ) : (
                    <Button
                      variant="clear"
                      colorScheme={isStepUnchecked ? 'black' : 'green'}
                      px={2}
                      size="sm"
                      flexShrink={1}
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
                </Flex>
                <Flex>
                  {shouldShowSaveButton && (
                    <Button
                      variant="outline"
                      // cant use responsive value for variant for some reason
                      // so we have to use borderWidth instead
                      borderWidth={{ base: '1px', lg: 0 }}
                      size="sm"
                      colorScheme="black"
                      onClick={handleSave}
                      isDisabled={!isDirty}
                      mr={2}
                      w="auto"
                      data-test="flow-substep-save-without-checking-button"
                    >
                      {!isDirty ? 'Saved' : 'Save without checking'}
                    </Button>
                  )}
                  {previewButton}
                  <CheckAgainButton
                    isUnstyledInfobox={isStepUnchecked}
                    onClick={handleSaveAndTest}
                    isLoading={isTestExecuting}
                    isDisabled={!isValid || readOnly}
                    step={step}
                    executionStepMetadata={currentTestExecutionStep?.metadata}
                  />
                </Flex>
              </Flex>
            </Infobox>
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
                <ErrorResult errorDetails={lastErrorDetails} isTestRun={true} />
              </Box>
            )}
            <HStack w="100%" justifyContent="flex-end">
              {/* gathersg is a special case where there is a webhook url and the save step button
              needs to be shown to save the encryption key */}
              {((!step.webhookUrl && !isMrfStep) ||
                step.appKey === 'gathersg') && (
                <Button
                  isDisabled={readOnly || isSaving || !isDirty}
                  isLoading={isSaving}
                  variant="clear"
                  onClick={handleSave}
                  data-test="flow-substep-save-button"
                >
                  {isDirty ? 'Save' : 'Saved'}
                </Button>
              )}
              {previewButton}
              <CheckStepTooltip
                hasDeletedVars={hasDeletedVars}
                isDisabled={shouldAllowCheckStep}
                isReadOnly={readOnly}
              >
                <Button
                  onClick={() => handleSaveAndTest()}
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
      {previewModal}
    </>
  )
}
