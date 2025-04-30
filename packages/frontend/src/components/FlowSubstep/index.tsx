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
import { validateSubstep } from '@/helpers/editor'

import { EDITOR_MARGIN_TOP } from '../Editor/constants'

type FlowSubstepProps = {
  hasConnection: boolean
  isTrigger: boolean
  substep: ISubstep
  step: IStep
  selectedActionOrTrigger?: ITrigger | IAction
}

function FlowSubstep(props: FlowSubstepProps): JSX.Element {
  const { hasConnection, isTrigger, substep, step, selectedActionOrTrigger } =
    props
  const { flags } = useContext(LaunchDarklyContext)
  const formContext = useFormContext()
  const { readOnly, executeTestStep, onUpdateStep } = useContext(EditorContext)
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

  /*
   * NOTE: we use dirtyFields instead of isDirty because dirtyFields only tracks
   * fields that are currently different from their default values, whereas
   * isDirty tracks if the form values have changed at all from the default values
   * — even if you change a field back to its original value.
   */
  const { dirtyFields } = formContext.formState
  const isDirty = Object.keys(dirtyFields).length > 0

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
      const validationResult = validateSubstep(substep, step as IStep)
      setIsValid(validationResult)
    }
    const subscription = formContext.watch(validate)

    return () => subscription.unsubscribe()
  }, [substep, formContext.watch, formContext])

  // NOTE: this is meant to avoid users losing progress
  // we validate the substeps so that the header reflects the correct status
  const handleSave = useCallback(async () => {
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

  const handleSaveAndTest = useCallback(async () => {
    await handleSave()
    await executeTestStep()
    onTestResultOpen()
  }, [handleSave, executeTestStep, onTestResultOpen])

  return (
    <Box position="relative" display="flex" flexDirection="column">
      {(!isTrigger || argsToDisplay?.length > 0) && (
        <Box flex="1" p="1rem 1rem">
          <Stack w="100%" spacing={4}>
            {argsToDisplay?.map((argument) => (
              <InputCreator
                key={argument.key}
                schema={argument}
                namePrefix="parameters"
                stepId={step.id}
                disabled={readOnly || isSaving}
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
      />
    </Box>
  )
}

export default FlowSubstep
