import type {
  IField,
  IJSONObject,
  IJSONValue,
  IStep,
  ISubstep,
} from '@plumber/types'

import * as React from 'react'
import { useFormContext } from 'react-hook-form'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import ListItem from '@mui/material/ListItem'
import Stack from '@mui/material/Stack'
import FlowSubstepTitle from 'components/FlowSubstepTitle'
import InputCreator from 'components/InputCreator'
import { EditorContext } from 'contexts/Editor'

type FlowSubstepProps = {
  substep: ISubstep
  expanded?: boolean
  onExpand: () => void
  onCollapse: () => void
  onChange: ({ step }: { step: IStep }) => void
  onSubmit: () => void
  step: IStep
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
    if (arg.hidden || arg.required === false) {
      return true
    }

    // Edge case: multirow doesn't have a value; it has nested fields instead.
    if (arg.type === 'multirow') {
      const rows = (step.parameters[arg.key] ?? []) as IJSONObject[]
      if (rows.length === 0) {
        return false
      }

      return arg.subFields
        .filter(
          // Ignore hidden or optional subfields
          (subField) => !(subField.hidden || subField.required === false),
        )
        .every((subField) =>
          rows.every((row) => {
            subField
            return isValidArgValue(row[subField.key])
          }),
        )
    }

    return isValidArgValue(step.parameters[arg.key])
  })
}

function FlowSubstep(props: FlowSubstepProps): React.ReactElement {
  const {
    substep,
    expanded = false,
    onExpand,
    onCollapse,
    onSubmit,
    step,
  } = props

  const { name, arguments: args } = substep

  const editorContext = React.useContext(EditorContext)
  const formContext = useFormContext()
  const [validationStatus, setValidationStatus] = React.useState<
    boolean | null
  >(validateSubstep(substep, formContext.getValues() as IStep))

  React.useEffect(() => {
    function validate(step: unknown) {
      const validationResult = validateSubstep(substep, step as IStep)
      setValidationStatus(validationResult)
    }
    const subscription = formContext.watch(validate)

    return () => subscription.unsubscribe()
  }, [substep, formContext.watch, formContext])

  const onToggle = expanded ? onCollapse : onExpand

  return (
    <React.Fragment>
      <FlowSubstepTitle
        expanded={expanded}
        onClick={onToggle}
        title={name}
        valid={validationStatus}
      />
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <ListItem
          sx={{
            pt: 2,
            pb: 3,
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}
        >
          <Stack width="100%" spacing={2}>
            {args
              ?.filter((argument) => !argument.hidden)
              ?.map((argument) => (
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
            fullWidth
            variant="contained"
            onClick={onSubmit}
            sx={{ mt: 2 }}
            disabled={!validationStatus || editorContext.readOnly}
            type="submit"
            data-test="flow-substep-continue-button"
          >
            Continue
          </Button>
        </ListItem>
      </Collapse>
    </React.Fragment>
  )
}

export default FlowSubstep
