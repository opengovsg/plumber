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

import AutofillConfirmDialog from './AutofillConfirmDialog'
import RowDivider from './RowDivider'
import useAutofill from './useAutofill'

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
  // See IFieldMultiRowMultiCol.autofillable.
  autofillable?: boolean
  // Optional node rendered beside the "+ And" add-row button (e.g. a wrapper's
  // own controls). Renders even when the add-row button is hidden at maxRows.
  addButtonSuffix?: ReactNode
  // Optional override for deleting the LAST remaining row. When provided and non-null, the
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
    autofillable,
    addButtonSuffix,
    onRequestRemoveLastRow,
    ...forwardedInputCreatorProps
  } = props

  const { control, getValues, setValue } = useFormContext()
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
    replace,
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
    // A nested useFieldArray's `append` (like `remove`) updates the form value
    // but does not fire the form's `watch` subject, so subscribers such as the
    // step validator gating "Check step" never recompute. Re-assert the
    // already-updated value through `setValue`, which does notify.
    setValue(name, getValues(name), {
      shouldDirty: true,
      shouldValidate: true,
    })
  }, [append, newRowDefaultValue, subFields, setValue, getValues, name])

  const {
    canAutofill,
    isLoading: isDynamicDataLoading,
    onAutofillClick,
    confirm,
  } = useAutofill({
    autofillable,
    type,
    subFields,
    stepId: forwardedInputCreatorProps.stepId,
    name,
    newRowDefaultValue,
    replace,
    getValues,
    setValue,
  })

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
            return
          }
          remove(index)
          // A nested useFieldArray's `remove` updates the form value but does not
          // fire the form's `watch` subject, so subscribers (e.g. the step
          // validator that gates "Check step") never recompute. Re-assert the
          // already-updated value through `setValue`, which does notify.
          setValue(name, getValues(name), {
            shouldDirty: true,
            shouldValidate: true,
          })
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
              {canAutofill && (
                <Button
                  variant="outline"
                  maxW="fit-content"
                  isDisabled={isEditorReadOnly}
                  isLoading={isDynamicDataLoading}
                  onClick={onAutofillClick}
                >
                  <BiPlus /> Autofill
                </Button>
              )}
              {addButtonSuffix}
            </Flex>

            {canAutofill && <AutofillConfirmDialog confirm={confirm} />}
          </Flex>
        )
      }}
    />
  )
}

export default MultiRow
