import type { IFieldBooleanRadioOptions } from '@plumber/types'

import { Controller, useFormContext } from 'react-hook-form'
import Markdown from 'react-markdown'
import { FormControl, RadioGroup, Stack } from '@chakra-ui/react'
import {
  FormErrorMessage,
  FormLabel,
  Radio,
} from '@opengovsg/design-system-react'

interface BooleanRadioProps {
  name: string
  label?: string
  description?: string
  required?: boolean
  defaultValue?: boolean
  options?: IFieldBooleanRadioOptions
}

function convertBooleanToString(value: boolean | null): string {
  if (value === null) {
    return ''
  }
  return value ? 'yes' : 'no'
}

function convertStringToBoolean(value: string): boolean | null {
  if (value === '') {
    return null
  }
  return value === 'yes'
}

// show no then yes by default
const defaultLabelOptions: IFieldBooleanRadioOptions = [
  {
    label: 'No',
    value: false,
  },
  {
    label: 'Yes',
    value: true,
  },
]

export default function BooleanRadio(props: BooleanRadioProps) {
  const {
    name,
    label,
    required = false,
    defaultValue,
    description,
    options,
  } = props
  const { control } = useFormContext()

  return (
    <Controller
      name={name}
      rules={{ required }}
      control={control}
      defaultValue={defaultValue}
      render={({
        field: { onChange, value },
        fieldState: { isTouched, error },
      }) => {
        const isError = Boolean(isTouched && !!error)

        return (
          <FormControl isInvalid={isError}>
            {label && (
              <FormLabel
                isRequired={required}
                description={
                  description && (
                    <Markdown linkTarget="_blank">{description}</Markdown>
                  )
                }
              >
                {label}
              </FormLabel>
            )}

            <RadioGroup
              onChange={
                (selectedValue) =>
                  onChange(convertStringToBoolean(selectedValue)) // store null in db for backwards compat
              }
              // value will be empty if not provided on backend, null if user did not select
              value={value === '' ? value : convertBooleanToString(value)}
              colorScheme="secondary"
            >
              <Stack>
                {(options ?? defaultLabelOptions).map((radioOption) => {
                  const optionStr = convertBooleanToString(radioOption.value)
                  return (
                    <Radio
                      key={optionStr}
                      allowDeselect={!required}
                      value={optionStr}
                    >
                      {radioOption.label}
                    </Radio>
                  )
                })}
              </Stack>
            </RadioGroup>

            {isError && <FormErrorMessage>{error?.message}</FormErrorMessage>}
          </FormControl>
        )
      }}
    />
  )
}
