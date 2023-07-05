import { TDataOutMetadatumType } from '@plumber/types'

import { useContext, useMemo } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { FormControl } from '@chakra-ui/react'
import {
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  MultiSelect as DSMultiSelect,
} from '@opengovsg/design-system-react'
import { StepExecutionsContext } from 'contexts/StepExecutions'

import extractVariablesAsItems from './helpers/extract-variables-as-items'

interface MultiSelectProps {
  name: string
  label: string
  description?: string
  required?: boolean
  variableTypes?: TDataOutMetadatumType[]
}

/**
 * Currently only supports multiple select from variables.
 * FUTURE: single select, hard coded options, freeSolo
 */
function MultiSelect(props: MultiSelectProps): React.ReactElement {
  const {
    name,
    label,
    description = null,
    required = false,
    variableTypes = null,
  } = props
  const { control } = useFormContext()
  const priorSteps = useContext(StepExecutionsContext)

  const items = useMemo(
    () => extractVariablesAsItems(priorSteps, variableTypes),
    [priorSteps, variableTypes],
  )

  return (
    <Controller
      name={name}
      rules={{ required }}
      control={control}
      defaultValue={[]}
      render={({
        field: { onChange, value: values },
        fieldState: { error },
      }) => (
        <FormControl isInvalid={!!error}>
          <FormLabel isRequired>{label}</FormLabel>
          <DSMultiSelect
            items={items}
            values={values}
            name={name}
            onChange={(newValues) =>
              // Sort to prevent footgun where undefined array ordering messes
              // up later actions. Example:
              //   1. Multiselect has ["apple", "oranges"] selected.
              //   2. User puts the 1st element of the multiselect as another
              //      action's variable.
              //      - e.g. {{step.multi-select-field.0}}
              //   3. User changes selection to ["oranges", "watermelon"].
              //   4. User regrets choosing watermelon, decides to revert back
              //      to apples and oranges.
              //      - But this time, he ticks the boxes in reverse order from
              //        how he ticked in step 1.
              //      - Multiselect now has ["oranges", "apple"] selected.
              //   5. User's pipe now starts outputting "oranges" instead of
              //      "apple", although to the user, it seems like nothing has
              //      changed.
              onChange(newValues.sort())
            }
          />
          {description && <FormHelperText>{description}</FormHelperText>}
          {error && <FormErrorMessage>{error.message}</FormErrorMessage>}
        </FormControl>
      )}
    />
  )
}

export default MultiSelect
