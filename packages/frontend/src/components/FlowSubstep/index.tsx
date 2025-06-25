import type { IAction, IStep, ISubstep, ITrigger } from '@plumber/types'

import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { Box, Stack, useDisclosure } from '@chakra-ui/react'
import { useToast } from '@opengovsg/design-system-react'

import FlowStepTestController from '@/components/FlowStepTestController'
import InputCreator from '@/components/InputCreator'
import { getInputFlag } from '@/config/flags'
import { EditorContext } from '@/contexts/Editor'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'
import { hasDirtyFields, validateSubstep } from '@/helpers/editor'
import { isIfThenStep } from '@/helpers/toolbox'
import { validateStepParams } from '@/helpers/validateStepParams'

type FlowSubstepProps = {
  hasConnection: boolean
  isTrigger: boolean
  substep: ISubstep
  step: IStep
  selectedActionOrTrigger?: ITrigger | IAction
}

function FlowSubstep(props: FlowSubstepProps): JSX.Element {
  const { isTrigger, substep, step, selectedActionOrTrigger } = props
  const { flags } = useContext(LaunchDarklyContext)
  const formContext = useFormContext()
  const {
    executeTestStep,
    onUpdateStep,
    setShouldWarnOnLeave,
    testExecutionSteps,
  } = useContext(EditorContext)
  const {
    isOpen: isTestResultOpen,
    onOpen: onTestResultOpen,
    onClose: onTestResultClose,
  } = useDisclosure()

  const { arguments: args } = substep
  const toast = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [isValid, setIsValid] = useState<boolean>(
    validateSubstep(substep, formContext.getValues() as IStep),
  )
  const [hasDeletedVars, setHasDeletedVars] = useState(false)

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
        if (!flags) {
          return true
        }
        const flag = getInputFlag(selectedActionOrTrigger?.key ?? '', arg.key)
        return !flags[flag] || +step.createdAt <= flags[flag]
      }) || [],
    [args, flags, step.createdAt, selectedActionOrTrigger],
  )

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
      toast({
        title: 'Error saving step',
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsSaving(false)
    }
  }, [formContext, onUpdateStep, substep, toast])

  const handleSave = useCallback(async () => {
    await saveStep()
    toast({
      title: 'Step saved successfully!',
      status: 'success',
      duration: 2000,
      isClosable: true,
    })
  }, [saveStep, toast])

  const handleSaveAndTest = useCallback(
    async (testRunMetadata?: Record<string, unknown>) => {
      await saveStep()
      await executeTestStep(testRunMetadata)
      if (!isIfThenStep(step)) {
        onTestResultOpen()
      }
    },
    [saveStep, executeTestStep, step, onTestResultOpen],
  )

  return (
    <Box position="relative" display="flex" flexDirection="column">
      {(!isTrigger || argsToDisplay.length > 0) && (
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
        handleSave={handleSave}
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
