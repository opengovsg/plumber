import { TDataOutMetadatumType } from '@plumber/types'

import { useContext, useMemo } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { FormControl } from '@chakra-ui/react'
import {
  FormErrorMessage,
  FormLabel,
  MultiSelect as DSMultiSelect,
} from '@opengovsg/design-system-react'
import { StepExecutionsContext } from 'contexts/StepExecutions'

import extractVariablesAsItems from './helpers/extract-variables-as-items'

interface MultiSelectProps {
  name: string
  label: string
  required?: boolean
  variableTypes?: TDataOutMetadatumType[]
}

/**
 * Currently only supports multiple select from variables.
 * FUTURE: single select, hard coded options, freeSolo
 */
function MultiSelect(props: MultiSelectProps): React.ReactElement {
  const { name, label, required = false, variableTypes = null } = props
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
            onChange={onChange}
          />
          {error && <FormErrorMessage>{error.message}</FormErrorMessage>}
        </FormControl>
      )}
    />
  )
}

export default MultiSelect
