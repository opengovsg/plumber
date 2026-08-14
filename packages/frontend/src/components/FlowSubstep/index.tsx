import type { IAction, IStep, ISubstep, ITrigger } from '@plumber/types'

import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { Box, Stack, useDisclosure, usePrevious } from '@chakra-ui/react'

import FlowStepTestController from '@/components/FlowStepTestController'
import InputCreator from '@/components/InputCreator'
import { getInputFlag } from '@/config/flags'
import { EditorContext } from '@/contexts/Editor'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'
import { hasDirtyFields, validateSubstep } from '@/helpers/editor'
import { isIfThenStep } from '@/helpers/toolbox'
import { validateStepParams } from '@/helpers/validateStepParams'
import { useIfThenV2Enabled } from '@/hooks/useIfThenV2Enabled'

type FlowSubstepProps = {
  hasConnection: boolean
  isTrigger: boolean
  substep: ISubstep
  step: IStep
  selectedActionOrTrigger?: ITrigger | IAction
}

function FlowSubstep(props: FlowSubstepProps): JSX.Element {
  const { substep, step, selectedActionOrTrigger } = props
  const { getFlagValue } = useContext(LaunchDarklyContext)
  const formContext = useFormContext()
  const {
    executeTestStep,
    onUpdateStep,
    setShouldWarnOnLeave,
    testExecutionSteps,
    isTestExecuting,
  } = useContext(EditorContext)
  const {
    isOpen: isTestResultOpen,
    onOpen: onTestResultOpen,
    onClose: onTestResultClose,
  } = useDisclosure()

  const { arguments: args } = substep
  const { isEnabled: isIfThenV2Enabled, isLoading: isIfThenV2Loading } =
    useIfThenV2Enabled()
  const [isSaving, setIsSaving] = useState(false)
  const [isValid, setIsValid] = useState<boolean>(
    validateSubstep(substep, formContext.getValues() as IStep),
  )
  const [hasDeletedVars, setHasDeletedVars] = useState(false)
  const previousIsTestExecuting = usePrevious(isTestExecuting)

  /*
   * NOTE: we use dirtyFields instead of isDirty because dirtyFields only tracks
   * fields that are currently different from their default values, whereas
   * isDirty tracks if the form values have changed at all from the default values
   * — even if you change a field back to its original value.
   */
  const { dirtyFields } = formContext.formState
  const isDirty = hasDirtyFields(dirtyFields)
  useEffect(() => {
    onTestResultClose()
    setShouldWarnOnLeave(isDirty)
  }, [isDirty, onTestResultClose, setShouldWarnOnLeave])

  // filter inputs hidden behind feature flags based on timestamp
  const argsToDisplay = useMemo(
    () =>
      args?.filter((arg) => {
        // TODO: remove this branchName-specific check once if-then V2 is
        // rolled out to 100% and if-then V1 is retired.
        if (
          arg.key === 'branchName' &&
          isIfThenStep(step) &&
          isIfThenV2Enabled &&
          !isIfThenV2Loading
        ) {
          return false
        }
        const inputFlag = getInputFlag(
          selectedActionOrTrigger?.key ?? '',
          arg.key,
        )
        const flagValue = getFlagValue(inputFlag, false)
        return !flagValue || +step.createdAt <= flagValue
      }) || [],
    [
      args,
      step,
      isIfThenV2Enabled,
      isIfThenV2Loading,
      selectedActionOrTrigger,
      getFlagValue,
    ],
  )

  /**
   * We show the test result right after a chek step is run
   * i.e. isTestExecuting = true --> isTestExecuting = false
   */
  useEffect(() => {
    if (isTestExecuting === false && previousIsTestExecuting === true) {
      onTestResultOpen()
    }
  }, [isTestExecuting, onTestResultOpen, step, previousIsTestExecuting])

  useEffect(() => {
    function validate(step: unknown) {
      const typedStep = step as IStep
      const validationResult = validateSubstep(substep, typedStep)
      const { shouldTestStepAgain: hasMissingRef } = validateStepParams(
        typedStep,
        testExecutionSteps,
        [substep],
      )
      setIsValid(validationResult && !hasMissingRef)
      setHasDeletedVars(hasMissingRef)
    }
    const subscription = formContext.watch(validate)

    return () => subscription.unsubscribe()
  }, [substep, formContext.watch, formContext, testExecutionSteps])

  // NOTE: this is meant to avoid users losing progress
  // we validate the substeps so that the header reflects the correct status
  const saveStep = useCallback(async () => {
    try {
      setIsSaving(true)
      const currentStep = formContext.getValues() as IStep
      const isSubStepValid = validateSubstep(substep, currentStep)
      const result = await onUpdateStep({
        ...currentStep,
        status: isSubStepValid ? 'completed' : 'incomplete',
      })

      if (!result) {
        throw new Error('Failed to save step')
      }
    } catch (error) {
      console.error('Error saving step', error)
      throw error // Re-throw the error so calling functions know saveStep failed
    } finally {
      setIsSaving(false)
    }
  }, [formContext, onUpdateStep, substep])

  const handleSaveAndTest = useCallback(
    async (testRunMetadata?: Record<string, unknown>) => {
      try {
        if (!selectedActionOrTrigger?.hiddenFromUser) {
          await saveStep()
        }
        await executeTestStep({ testRunMetadata })
      } catch {
        console.error('Error saving and test step')
      }
    },
    [selectedActionOrTrigger, executeTestStep, saveStep],
  )

  return (
    <Box position="relative" display="flex" flexDirection="column">
      {argsToDisplay.length > 0 && (
        <Box flex="1" p={0} pb={4}>
          <Stack w="100%" spacing={4}>
            {argsToDisplay.map((argument) => (
              <InputCreator
                key={argument.key}
                schema={argument}
                namePrefix="parameters"
                stepId={step.id}
              />
            ))}
          </Stack>
        </Box>
      )}

      <FlowStepTestController
        isDirty={isDirty}
        isSaving={isSaving}
        isTestResultOpen={isTestResultOpen}
        step={step}
        handleSave={saveStep}
        handleSaveAndTest={handleSaveAndTest}
        onTestResultOpen={onTestResultOpen}
        onTestResultClose={onTestResultClose}
        isValid={isValid}
        hasDeletedVars={hasDeletedVars}
      />
    </Box>
  )
}

export default FlowSubstep
