import type { IFieldMultiRowMultiColSubField } from '@plumber/types'

import React, { useContext } from 'react'
import { useFormContext } from 'react-hook-form'
import { BiTrash } from 'react-icons/bi'
import { Box, Divider, Flex, Text } from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import InputCreator from '@/components/InputCreator'
import { EditorContext } from '@/contexts/Editor'

import { applyDynamicPlaceholder } from './utils'

type MultiColProps = {
  name: string
  subFields: IFieldMultiRowMultiColSubField[]
  visibleColumnKeys?: Set<string>
  canRemoveRow?: boolean
  isEditorReadOnly?: boolean
  remove?: (index?: number | number[]) => void
  index?: number
}

export default function MultiCol(props: MultiColProps) {
  const {
    name,
    subFields,
    visibleColumnKeys,
    canRemoveRow,
    isEditorReadOnly,
    remove,
    index,
    ...forwardedInputCreatorProps
  } = props

  const { isMobile } = useContext(EditorContext)
  const { getValues } = useFormContext()

  // Desktop table headers sit above the first row only. Mobile stacks columns,
  // so labels are shown per input instead.
  const hasColumnHeaders = !isMobile && subFields.some((subF) => subF.label)

  const DeleteButton = () => {
    return (
      <IconButton
        variant="clear"
        aria-label="Remove"
        icon={<BiTrash />}
        isDisabled={isEditorReadOnly}
        onClick={() => remove?.(index)}
        colorScheme="secondary"
      />
    )
  }

  const renderSubFieldInput = (
    subF: IFieldMultiRowMultiColSubField,
    subFIndex: number,
  ) => {
    const { type, variables } = subF

    // Desktop: labels/descriptions/tooltips only on the first row, and never
    // once they are rendered as column headers. Mobile: every stacked row
    // needs its own labels.
    const shouldShowFieldLabel = isMobile || (index === 0 && !hasColumnHeaders)
    let schemaWithConditionalLabel = shouldShowFieldLabel
      ? subF
      : {
          ...subF,
          label: undefined,
          description: undefined,
          tooltipText: undefined,
        }

    schemaWithConditionalLabel = applyDynamicPlaceholder(
      schemaWithConditionalLabel,
      getValues(name),
    )

    return (
      <InputCreator
        schema={schemaWithConditionalLabel}
        namePrefix={name}
        parentType="multicol"
        autoFocus={subFIndex === 0 && type === 'string' && variables}
        {...forwardedInputCreatorProps}
      />
    )
  }

  return (
    <Flex flexDir={isMobile ? 'column' : 'row'} gap={2} alignItems="flex-end">
      {subFields.map((subF, subFIndex) => {
        const showDeleteButton = subFIndex === 0 && canRemoveRow
        return isMobile ? (
          <React.Fragment key={`${name}.${subF.key}`}>
            {index !== 0 && subFIndex === 0 && <Divider />}
            <Flex
              key={`${name}.${subF.key}`}
              style={{ flex: 1, width: '100%', marginTop: 8 }}
            >
              {renderSubFieldInput(subF, subFIndex)}
              {showDeleteButton && <DeleteButton />}
            </Flex>
          </React.Fragment>
        ) : hasColumnHeaders && index === 0 ? (
          // Stretching keeps the header pinned to the top and the input to the
          // bottom, so a hidden input or a wrapped header can't knock the row
          // out of line.
          <Flex
            key={`${name}.${subF.key}`}
            flexDir="column"
            alignSelf="stretch"
            style={subF.customStyle}
          >
            {(visibleColumnKeys?.has(subF.key) ?? true) && (
              <Text textStyle="caption-3" color="base.content.medium" mb={2}>
                {subF.label}
              </Text>
            )}
            <Box mt="auto">{renderSubFieldInput(subF, subFIndex)}</Box>
          </Flex>
        ) : (
          <div key={`${name}.${subF.key}`} style={subF.customStyle}>
            {renderSubFieldInput(subF, subFIndex)}
          </div>
        )
      })}
      {!isMobile && canRemoveRow && <DeleteButton />}
    </Flex>
  )
}
