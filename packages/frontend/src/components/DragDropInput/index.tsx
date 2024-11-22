import { useCallback, useState } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import Markdown from 'react-markdown'
import { FormControl, Input, Stack } from '@chakra-ui/react'
import { FormErrorMessage, FormLabel } from '@opengovsg/design-system-react'

import FileUpload from '@/components/FileUpload'

const SECRET_KEY_REGEX = /^[a-zA-Z0-9/+]+={0,2}$/

interface DragDropInputProps {
  name: string
  autoComplete?: string
  defaultValue?: string
  description?: string
  label?: string
  placeholder?: string
  required?: boolean
}

function DragDropInput(props: DragDropInputProps) {
  const {
    name,
    defaultValue,
    description,
    label,
    placeholder,
    required,
    ...inputProps
  } = props
  const [dragging, setDragging] = useState(false)

  const { control, setError, setValue } = useFormContext()

  const processFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        if (!e.target) {
          return
        }
        const text = e.target.result?.toString()

        if (!text || !SECRET_KEY_REGEX.test(text)) {
          return setError(
            name,
            {
              type: 'invalidFile',
              message: 'Selected file seems to be invalid',
            },
            { shouldFocus: true },
          )
        }
        setValue(name, text, { shouldValidate: true })
      }
      reader.readAsText(file)
    },
    [name, setError, setValue],
  )

  const preventDefaults = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragEnter = (e: React.DragEvent) => {
    preventDefaults(e)
    setDragging(true)
  }

  const handleDragOver = (e: React.DragEvent) => {
    preventDefaults(e)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    preventDefaults(e)
    setDragging(false)
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      preventDefaults(e)
      setDragging(false)

      const file = e.dataTransfer.files?.[0]
      if (!file) {
        return
      }

      processFile(file)
    },
    [processFile],
  )

  return (
    <Controller
      name={name}
      control={control}
      defaultValue={defaultValue || ''}
      render={({
        field: { onChange: controllerOnChange, ...field },
        fieldState: { error },
      }) => {
        return (
          <>
            <FormControl isInvalid={!!error}>
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
              <Stack spacing="0.5rem" direction="row">
                <Input
                  {...inputProps}
                  {...field}
                  type="password"
                  onChange={(...args) => controllerOnChange(...args)}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  placeholder={
                    dragging
                      ? 'Drop your file here'
                      : placeholder ?? 'Enter or drop your file here'
                  }
                />
                <FileUpload accept="text/plain" processFile={processFile} />
              </Stack>
              {error && <FormErrorMessage>{error?.message}</FormErrorMessage>}
            </FormControl>
          </>
        )
      }}
    />
  )
}

export default DragDropInput
