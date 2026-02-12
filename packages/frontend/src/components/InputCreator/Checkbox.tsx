import { useContext } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { FormControl, Text } from '@chakra-ui/react'
import {
  Checkbox as ChakraCheckbox,
  FormErrorMessage,
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
            <ChakraCheckbox
              isChecked={isChecked}
              onChange={(e) => {
                if (!readOnly) {
                  onChange(e.target.checked)
                }
              }}
              isDisabled={readOnly}
              colorScheme="secondary"
              pl={2.5}
              _hover={{ bg: 'interaction.muted.neutral.hover' }}
              _focusWithin={{ outline: 'none', boxShadow: 'none' }}
            >
              {label && <Text textStyle="subhead-1">{label}</Text>}

              {description && (
                <Text textStyle="body-2" color="base.content.medium">
                  {description}
                </Text>
              )}
            </ChakraCheckbox>

            {isError && <FormErrorMessage>{error?.message}</FormErrorMessage>}
          </FormControl>
        )
      }}
    />
  )
}
