import type { IField, IJSONValue } from '@plumber/types'

import { ReactNode, useCallback, useContext, useEffect, useMemo } from 'react'
import { Controller, useFieldArray, useFormContext } from 'react-hook-form'
import { BiPlus, BiTrash } from 'react-icons/bi'
import Markdown from 'react-markdown'
import { Flex } from '@chakra-ui/react'
import { Button, FormLabel, IconButton } from '@opengovsg/design-system-react'

import InputCreator, { InputCreatorProps } from '@/components/InputCreator'
import { EditorContext } from '@/contexts/Editor'

import MultiCol from '../MultiCol.tsx'

import RowDivider from './RowDivider'

export type MultiRowProps = {
  name: string
  subFields: IField[]
  required?: boolean
  label?: string
  description?: string
  flexDir?: string
  showDivider?: boolean
  addRowButtonText?: string
  type?: string
  maxRows?: number
  defaultValue?: string | IJSONValue
  // Optional node rendered beside the "+ And" add-row button (e.g. a wrapper's
  // own controls). Renders even when the add-row button is hidden at maxRows.
  addButtonSuffix?: ReactNode
  // Optional override for deleting the LAST remaining row. When provided, the
  // last row's delete control is shown (even when `required`) and clicking it
  // calls this instead of the internal remove — letting a wrapper (e.g.
  // GroupedMultiRow) remove the whole containing group instead of leaving it
  // empty. When omitted, `required` keeps the last row undeletable as before.
  onRequestRemoveLastRow?: () => void
} & Omit<InputCreatorProps, 'schema' | 'namePrefix'>

function MultiRow(props: MultiRowProps): JSX.Element {
  const {
    name,
    subFields,
    label,
    required,
    description,
    addRowButtonText,
    showDivider,
    type,
    maxRows,
    defaultValue,
    addButtonSuffix,
    onRequestRemoveLastRow,
    ...forwardedInputCreatorProps
  } = props

  const { control, setValue } = useFormContext()
  const { readOnly: isEditorReadOnly } = useContext(EditorContext)

  // react-hook-form requires a non-undefined default value for _every_
  // sub-field when adding a new row. Otherwise, it goofs up and populates new
  // rows with deleted data.
  const newRowDefaultValue = useMemo(() => {
    const result: Record<string, unknown> = {}
    for (const subField of subFields) {
      result[subField.key] = subField.value ?? undefined
    }
    return result
  }, [subFields])

  const {
    fields: rows,
    append,
    remove,
  } = useFieldArray({
    name,
    rules: { required },
  })

  useEffect(() => {
    if (defaultValue) {
      setValue(name, defaultValue)
    }
  }, [defaultValue, name, setValue])

  const handleAddRow = useCallback(() => {
    // NOTE: only need to use this flag to focus on the rte
    // if the first column is a variable-enabled string field
    const firstColIsRte =
      subFields?.[0]?.type === 'string' && subFields?.[0]?.variables
    if (firstColIsRte) {
      append({ ...newRowDefaultValue, isNew: true })
    } else {
      append(newRowDefaultValue)
    }
  }, [append, newRowDefaultValue, subFields])

  return (
    // Use Controller's defaultValue to introduce 1 blank row by default. We
    // copy newRowDefaultValue to account for pass-by-reference.
    <Controller
      name={name}
      control={control}
      render={(): JSX.Element => {
        // If field is required, don't allow removal if there is only 1 row
        // remaining.
        const rowsToRender =
          !rows.length && required ? [{ ...newRowDefaultValue }] : rows
        const canRemoveRow =
          !required || rowsToRender.length > 1 || !!onRequestRemoveLastRow
        const canAddRow = maxRows == null || rowsToRender.length < maxRows

        // Deleting the last remaining row is delegated to the wrapper (e.g. to
        // remove the whole group) when onRequestRemoveLastRow is provided;
        // otherwise it's an internal row removal.
        const removeRow = (index: number) => {
          if (rowsToRender.length === 1 && onRequestRemoveLastRow) {
            onRequestRemoveLastRow()
          } else {
            remove(index)
          }
        }

        return (
          <Flex flexDir="column">
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

            {rowsToRender.map((row, index) => {
              const namePrefix = `${name}.${index}`
              return (
                <Flex
                  key={`${row.id}-${index}`}
                  flexDir="column"
                  gap={4}
                  mb={4}
                >
                  {type === 'multirow-multicol' ? (
                    <>
                      <MultiCol
                        name={namePrefix}
                        subFields={subFields}
                        canRemoveRow={canRemoveRow}
                        isEditorReadOnly={isEditorReadOnly}
                        remove={() => removeRow(index)}
                        index={index}
                        {...forwardedInputCreatorProps}
                      />
                      {/*
                       * "And" divider
                       */}
                      {showDivider && index !== rowsToRender.length - 1 && (
                        <RowDivider />
                      )}
                    </>
                  ) : (
                    <>
                      {/*
                       * Sub-Fields
                       *
                       * Note: we edge case the 1st sub-field to show our "remove
                       * row" icon
                       */}
                      <Flex alignItems="center" gap={2}>
                        <InputCreator
                          schema={subFields[0]}
                          namePrefix={namePrefix}
                          {...forwardedInputCreatorProps}
                        />
                        {canRemoveRow && (
                          <IconButton
                            variant="clear"
                            aria-label="Remove"
                            icon={<BiTrash />}
                            isDisabled={isEditorReadOnly}
                            onClick={() => removeRow(index)}
                            colorScheme="secondary"
                          />
                        )}
                      </Flex>
                      {subFields.slice(1).map((subField) => (
                        <InputCreator
                          key={`${row.id}.${subField.key}`}
                          schema={subField}
                          namePrefix={namePrefix}
                          {...forwardedInputCreatorProps}
                        />
                      ))}

                      {/*
                       * "And" divider
                       */}
                      {index !== rowsToRender.length - 1 && <RowDivider />}
                    </>
                  )}
                </Flex>
              )
            })}

            <Flex gap={2} alignItems="center">
              {canAddRow && (
                <Button
                  variant="outline"
                  leftIcon={<BiPlus />}
                  onClick={handleAddRow}
                  isDisabled={isEditorReadOnly}
                  maxW="fit-content"
                >
                  {addRowButtonText ?? 'And'}
                </Button>
              )}
              {addButtonSuffix}
            </Flex>
          </Flex>
        )
      }}
    />
  )
}

export default MultiRow
