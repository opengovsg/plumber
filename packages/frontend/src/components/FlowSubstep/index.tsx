import type {
  IField,
  IJSONObject,
  IJSONValue,
  IStep,
  ISubstep,
} from '@plumber/types'

import { useContext, useEffect, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { Box, Collapse, Stack } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import FlowSubstepTitle from '@/components/FlowSubstepTitle'
import InputCreator from '@/components/InputCreator'
import { EditorContext } from '@/contexts/Editor'
import { isFieldHidden } from '@/helpers/isFieldHidden'

type FlowSubstepProps = {
  substep: ISubstep
  expanded?: boolean
  onExpand: () => void
  onCollapse: () => void
  onChange: ({ step }: { step: IStep }) => void
  onSubmit: () => void
  step: IStep
  settingsLabel?: string
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
  } = props

  const { name, arguments: args } = substep

  const editorContext = useContext(EditorContext)
  const formContext = useFormContext()
  const [validationStatus, setValidationStatus] = useState<boolean>(
    validateSubstep(substep, formContext.getValues() as IStep),
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
            {args?.map((argument) => (
              <InputCreator
                key={argument.key}
                schema={argument}
                namePrefix="parameters"
                stepId={step.id}
                disabled={editorContext.readOnly}
              />
            ))}
          </Stack>

          <Button
            isFullWidth
            onClick={onSubmit}
            mt={4}
            isDisabled={!validationStatus || editorContext.readOnly}
            type="submit"
            data-test="flow-substep-continue-button"
          >
            Continue
          </Button>
        </Box>
      </Collapse>
    </>
  )
}

export default FlowSubstep
