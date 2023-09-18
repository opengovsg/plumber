import type { IField } from '@plumber/types'

import { useCallback, useContext, useMemo } from 'react'
import { Controller, useFieldArray, useFormContext } from 'react-hook-form'
import { BiPlus, BiTrash } from 'react-icons/bi'
import { AbsoluteCenter, Box, Divider, Flex, Text } from '@chakra-ui/react'
import { FormLabel, IconButton } from '@opengovsg/design-system-react'
import ConditionalIconButton from 'components/ConditionalIconButton'
import InputCreator, { InputCreatorProps } from 'components/InputCreator'
import { EditorContext } from 'contexts/Editor'

export type MultiRowProps = {
  name: string
  subFields: IField[]
  required?: boolean
  label?: string
  description?: string
} & Omit<InputCreatorProps, 'schema' | 'namePrefix'>

function MultiRow(props: MultiRowProps): JSX.Element {
  const {
    name,
    subFields,
    label,
    required,
    description,
    ...forwardedInputCreatorProps
  } = props

  const { control } = useFormContext()
  const { readOnly: isEditorReadOnly } = useContext(EditorContext)

  // react-hook-form requires a non-undefined default value for _every_
  // sub-field when adding a new row. Otherwise, it goofs up and populates new
  // rows with deleted data.
  const newRowDefaultValue = useMemo(() => {
    const result: Record<string, unknown> = {}
    for (const subField of subFields) {
      result[subField.key] = null
    }
    return result
  }, [subFields])

  return (
    // Use Controller's defaultValue to introduce 1 blank row by default. We
    // copy newRowDefaultValue to account for pass-by-reference.
    <Controller
      name={name}
      control={control}
      defaultValue={[{ ...newRowDefaultValue }]}
      render={({ field: { value: fallbackRows } }): JSX.Element => {
        const {
          fields: rows,
          append,
          remove,
        } = useFieldArray({
          name,
          rules: { required },
        })

        const handleAddRow = useCallback(() => {
          append(newRowDefaultValue)
        }, [append, newRowDefaultValue])

        // HACKFIX (ogp-weeloong): I don't know why `rows` lags behind
        // `fallbackRows` on the 1st render.
        const actualRows: typeof rows = rows.length === 0 ? fallbackRows : rows

        return (
          <Flex flexDir="column">
            <FormLabel isRequired={required} description={description}>
              {label}
            </FormLabel>

            {actualRows.map((row, index) => {
              const namePrefix = `${name}.${index}`
              const rowColour = index % 2 === 0 ? 'white' : 'primary.50'
              return (
                <Flex
                  key={namePrefix}
                  flexDir="column"
                  gap={2}
                  bg={rowColour}
                  mb={2}
                >
                  {/* edge case the 1st sub-field to show our "remove row" icon */}
                  <Flex alignItems="center" p={2}>
                    <InputCreator
                      schema={subFields[0]}
                      namePrefix={namePrefix}
                      {...forwardedInputCreatorProps}
                    />
                    <IconButton
                      variant="clear"
                      aria-label="Remove"
                      icon={<BiTrash />}
                      onClick={() => remove(index)}
                    />
                  </Flex>

                  {subFields.slice(1).map((subField) => (
                    <Box p={2}>
                      <InputCreator
                        key={`${row.id}.${subField.key}`}
                        schema={subField}
                        namePrefix={namePrefix}
                        {...forwardedInputCreatorProps}
                      />
                    </Box>
                  ))}
                  {index !== actualRows.length - 1 && (
                    <Box position="relative" my={2.5}>
                      <AbsoluteCenter bg="white" p={2.5}>
                        <Text textStyle="subhead-3">And</Text>
                      </AbsoluteCenter>
                      <Divider />
                    </Box>
                  )}
                </Flex>
              )
            })}

            <ConditionalIconButton
              variant="outline"
              icon={<BiPlus />}
              onClick={handleAddRow}
              isDisabled={isEditorReadOnly}
            >
              And
            </ConditionalIconButton>
          </Flex>
        )
      }}
    />
  )
}

export default MultiRow
