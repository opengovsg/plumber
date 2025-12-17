import type { IFieldMultiRowMultiColSubField } from '@plumber/types'

import React, { useContext } from 'react'
import { BiTrash } from 'react-icons/bi'
import { Divider, Flex } from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import InputCreator from '@/components/InputCreator'
import { EditorContext } from '@/contexts/Editor'

type MultiColProps = {
  name: string
  subFields: IFieldMultiRowMultiColSubField[]
  canRemoveRow?: boolean
  isEditorReadOnly?: boolean
  remove?: (index?: number | number[]) => void
  index?: number
}

export default function MultiCol(props: MultiColProps) {
  const {
    name,
    subFields,
    canRemoveRow,
    isEditorReadOnly,
    remove,
    index,
    ...forwardedInputCreatorProps
  } = props

  const { isMobile } = useContext(EditorContext)

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
    return (
      <InputCreator
        schema={subF}
        namePrefix={name}
        parentType="multicol"
        autoFocus={subFIndex === 0 && type === 'string' && variables}
        {...forwardedInputCreatorProps}
      />
    )
  }

  return (
    <Flex flexDir={isMobile ? 'column' : 'row'} gap={2} alignItems="center">
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
