import type {
  IAction,
  IField,
  IJSONObject,
  IJSONValue,
  IStep,
  ISubstep,
  ITrigger,
} from '@plumber/types'

import { useContext, useEffect, useMemo, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { Box, Collapse, Stack } from '@chakra-ui/react'
import { Button, useToast } from '@opengovsg/design-system-react'

import FlowSubstepTitle from '@/components/FlowSubstepTitle'
import InputCreator from '@/components/InputCreator'
import { getInputFlag } from '@/config/flags'
import { EditorContext } from '@/contexts/Editor'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'
import { isFieldHidden } from '@/helpers/isFieldHidden'

type FlowSubstepProps = {
  substep: ISubstep
  expanded?: boolean
  onExpand: () => void
  onCollapse: () => void
  onSubmit: (val: any) => Promise<void>
  step: IStep
  settingsLabel?: string
  selectedActionOrTrigger?: ITrigger | IAction
}

function isValidArgValue(value: IJSONValue): boolean {
  // `false` and 0 are valid values, only null, undefined and empty string are invalid
  return value != null && value !== ''
}

function validateSubstep(substep: ISubstep, step: IStep): boolean {
  if (!substep) {
    return true
  }

  const args: IField[] = substep.arguments || []

  return args.every((arg) => {
    if (
      arg.required === false ||
      isFieldHidden(arg.hiddenIf, step.parameters)
    ) {
      return true
    }

    // Edge case: multirow doesn't have a value; it has nested fields instead.
    if (arg.type === 'multirow') {
      const rows = (step.parameters[arg.key] ?? []) as IJSONObject[]
      if (rows.length === 0) {
        return false
      }

      //
      // For each required subfield in the multirow, check that every row has a
      // value for it.
      //
      for (const subField of arg.subFields) {
        // Ignore optional subfield
        // (required is true by default, so we strict equality against false)
        if (subField.required === false) {
          continue
        }

        for (const row of rows) {
          // Ignore subfield if it's hidden in this particular row
          if (isFieldHidden(subField.hiddenIf, row)) {
            continue
          }

          if (!isValidArgValue(row[subField.key])) {
            return false
          }
        }
      }

      return true
    }

    return isValidArgValue(step.parameters[arg.key])
  })
}

function FlowSubstep(props: FlowSubstepProps): JSX.Element {
  const {
    substep,
    expanded = false,
    onExpand,
    onCollapse,
    onSubmit,
    step,
    settingsLabel,
    selectedActionOrTrigger,
  } = props

  const { name, arguments: args } = substep
  const toast = useToast()
  const [isSaving, setIsSaving] = useState(false)

  const { flags } = useContext(LaunchDarklyContext)
  const editorContext = useContext(EditorContext)
  const formContext = useFormContext()
  /*
   * NOTE: we use dirtyFields instead of isDirty because dirtyFields only tracks
   * fields that are currently different from their default values, whereas
   * isDirty tracks if the form values have changed at all from the default values
   * — even if you change a field back to its original value.
   */
  const { dirtyFields } = formContext.formState
  const isDirty = Object.keys(dirtyFields).length > 0

  const [validationStatus, setValidationStatus] = useState<boolean>(
    validateSubstep(substep, formContext.getValues() as IStep),
  )

  // filter inputs hidden behind feature flags based on timestamp
  const argsToDisplay = useMemo(
    () =>
      args?.filter((arg) => {
        if (!flags) {
          return true
        }
        const flag = getInputFlag(selectedActionOrTrigger?.key ?? '', arg.key)
        return !flags[flag] || +step.createdAt <= flags[flag]
      }),
    [args, flags, step.createdAt, selectedActionOrTrigger],
  )

  useEffect(() => {
    function validate(step: unknown) {
      const validationResult = validateSubstep(substep, step as IStep)
      setValidationStatus(validationResult)
    }
    const subscription = formContext.watch(validate)

    return () => subscription.unsubscribe()
  }, [substep, formContext.watch, formContext])

  const onToggle = expanded ? onCollapse : onExpand

  // NOTE: this is meant to avoid users losing progress
  // we validate the substeps so that the header reflects the correct status

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const currentStep = formContext.getValues() as IStep
      const isValid = validateSubstep(substep, currentStep)
      const result = await editorContext.onUpdateStep({
        ...currentStep,
        status: isValid ? 'completed' : 'incomplete',
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
  }

  // Skip to the next step if the substep is meant to be hidden
  useEffect(() => {
    if (!expanded) {
      return
    }
    if (!argsToDisplay || argsToDisplay.length === 0) {
      onSubmit(formContext.getValues() as IStep)
    }
  }, [argsToDisplay, expanded, formContext, onSubmit])

  if (!argsToDisplay || argsToDisplay.length === 0) {
    return <></>
  }

  return (
    <>
      <FlowSubstepTitle
        expanded={expanded}
        onClick={onToggle}
        title={settingsLabel ?? name}
        valid={validationStatus}
      />
      <Collapse in={expanded} unmountOnExit style={{ overflow: 'initial' }}>
        <Box p="1rem 1rem 1.5rem">
          <Stack w="100%" spacing={4}>
            {argsToDisplay.map((argument) => (
              <InputCreator
                key={argument.key}
                schema={argument}
                namePrefix="parameters"
                stepId={step.id}
                disabled={editorContext.readOnly || isSaving}
              />
            ))}
          </Stack>

          <Stack
            direction="row"
            spacing={4}
            mt={4}
            justify="flex-end"
            borderTop="1px solid"
            borderTopColor="base.divider.medium"
            pt={4}
          >
            <Button
              isDisabled={editorContext.readOnly || isSaving || !isDirty}
              isLoading={isSaving}
              variant="clear"
              onClick={handleSave}
            >
              {isDirty ? 'Save' : 'Saved'}
            </Button>
            <Button
              onClick={() => onSubmit(formContext.getValues() as IStep)}
              data-test="flow-substep-continue-button"
              isDisabled={
                !validationStatus || editorContext.readOnly || isSaving
              }
            >
              Check step
            </Button>
          </Stack>
        </Box>
      </Collapse>
    </>
  )
}

export default FlowSubstep
