import { useContext } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import Markdown from 'react-markdown'
import { FormControl } from '@chakra-ui/react'
import {
  Checkbox as ChakraCheckbox,
  FormErrorMessage,
  FormLabel,
} from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'

interface CheckboxProps {
  name: string
  label?: string
  description?: string
  required?: boolean
  defaultValue?: boolean
}

export default function Checkbox(props: CheckboxProps) {
  const {
    name,
    label,
    required = false,
    defaultValue = false,
    description,
  } = props
  const { control } = useFormContext()
  const { readOnly } = useContext(EditorContext)

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
        const isChecked = value === true || value === 'true'

        return (
          <FormControl isInvalid={isError}>
            {label && <FormLabel isRequired={required}>{label}</FormLabel>}

            <ChakraCheckbox
              isChecked={isChecked}
              onChange={(e) => {
                if (!readOnly) {
                  onChange(e.target.checked)
                }
              }}
              isDisabled={readOnly}
              colorScheme="secondary"
            >
              {description && (
                <Markdown linkTarget="_blank">{description}</Markdown>
              )}
            </ChakraCheckbox>

            {isError && <FormErrorMessage>{error?.message}</FormErrorMessage>}
          </FormControl>
        )
      }}
    />
  )
}
