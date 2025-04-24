import { useContext } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { BiCopy } from 'react-icons/bi'
import Markdown from 'react-markdown'
import { FormControl, InputGroup, InputRightElement } from '@chakra-ui/react'
import {
  FormLabel,
  IconButton,
  Input,
  Textarea,
} from '@opengovsg/design-system-react'
import copy from 'clipboard-copy'

import { EditorContext } from '@/contexts/Editor'

type TextFieldProps = {
  shouldUnregister?: boolean
  name: string
  label?: string
  clickToCopy?: boolean
  readOnly?: boolean
  description?: string
  required?: boolean
  multiline?: boolean
  onChange?: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void
  onBlur?: (
    event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void
  placeholder?: string
  defaultValue?: string
}

export default function TextField(props: TextFieldProps): React.ReactElement {
  const { control } = useFormContext()
  const {
    required,
    name,
    label,
    description,
    defaultValue,
    placeholder,
    shouldUnregister,
    clickToCopy,
    multiline,
    readOnly,
    onBlur,
    onChange,
  } = props

  const SelectedComponent = multiline ? Textarea : Input
  const { readOnly: disabled } = useContext(EditorContext)

  return (
    <Controller
      rules={{ required: required }}
      name={name}
      defaultValue={defaultValue || ''}
      control={control}
      shouldUnregister={shouldUnregister}
      render={({
        field: {
          onChange: controllerOnChange,
          onBlur: controllerOnBlur,
          ...field
        },
      }) => (
        <FormControl>
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
          <InputGroup>
            <SelectedComponent
              {...field}
              placeholder={placeholder}
              onChange={(...args) => {
                controllerOnChange(...args)
                onChange?.(...args)
              }}
              onBlur={(...args) => {
                controllerOnBlur()
                onBlur?.(...args)
              }}
              isReadOnly={readOnly || disabled}
            />
            {clickToCopy && (
              <InputRightElement>
                <IconButton
                  icon={<BiCopy />}
                  colorScheme="primary"
                  variant="clear"
                  aria-label={'Copy'}
                  minHeight="42px"
                  mr="2px"
                  borderRadius="base"
                  onClick={() => copy(field.value)}
                />
              </InputRightElement>
            )}
          </InputGroup>
        </FormControl>
      )}
    />
  )
}
