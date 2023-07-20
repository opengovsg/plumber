import type { IField } from '@plumber/types'

import { useCallback } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { BiPlus, BiTrash } from 'react-icons/bi'
import { Flex } from '@chakra-ui/react'
import { FormLabel, IconButton } from '@opengovsg/design-system-react'
import ConditionalIconButton from 'components/ConditionalIconButton'
import InputCreator, { InputCreatorProps } from 'components/InputCreator'

export type MultiRowProps = {
  name: string
  fields: IField[]
  required?: boolean
  label?: string
  description?: string
} & Omit<InputCreatorProps, 'schema' | 'namePrefix'>

function MultiRow(props: MultiRowProps): JSX.Element {
  const {
    name,
    fields,
    label,
    required,
    description,
    ...forwardedInputCreatorProps
  } = props

  const { control } = useFormContext()
  const {
    fields: rows,
    append,
    remove,
  } = useFieldArray({
    control,
    name,
    rules: { required },
  })

  // react-hook-form requires us to specify a default value for _every_ field
  // when adding a new row - otherwise, it goofs up and populates new rows with
  // deleted data.
  const handleAddRow = useCallback(() => {
    const defaultValues: Record<string, unknown> = {}
    for (const field of fields) {
      defaultValues[field.key] = null
    }
    append(defaultValues)
  }, [append, fields])

  return (
    <Flex flexDir="column">
      <FormLabel isRequired={required} description={description}>
        {label}
      </FormLabel>

      {rows.map((row, index) => {
        const namePrefix = `${name}.${index}`
        const rowColour = index % 2 === 0 ? 'white' : 'primary.50'
        return (
          <Flex flexDir="column" gap={2} bg={rowColour} mb={2} p={2}>
            {/* edge case the 1st field to show our "remove row" icon */}
            <Flex alignItems="center">
              <InputCreator
                schema={fields[0]}
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
            {fields.slice(1).map((field) => (
              <InputCreator
                key={`${row.id}.${field.key}`}
                schema={field}
                namePrefix={namePrefix}
                {...forwardedInputCreatorProps}
              />
            ))}
          </Flex>
        )
      })}

      <ConditionalIconButton
        variant="outline"
        icon={<BiPlus />}
        onClick={handleAddRow}
      >
        Add
      </ConditionalIconButton>
    </Flex>
  )
}

export default MultiRow
