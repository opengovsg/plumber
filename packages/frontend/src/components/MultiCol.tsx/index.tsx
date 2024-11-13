import type { IField } from '@plumber/types'

import { BiTrash } from 'react-icons/bi'
import { Flex } from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import InputCreator from '@/components/InputCreator'

type MultiColProps = {
  name: string
  subFields: IField[]
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
  return (
    <Flex flexDir="row" gap={2}>
      {subFields.map((subF) => {
        return (
          <InputCreator
            key={`${name}.${subF.key}`}
            schema={subF}
            namePrefix={name}
            parentType="multicol"
            {...forwardedInputCreatorProps}
          />
        )
      })}
      {canRemoveRow && (
        <IconButton
          variant="clear"
          aria-label="Remove"
          icon={<BiTrash />}
          isDisabled={isEditorReadOnly}
          onClick={() => remove?.(index)}
        />
      )}
    </Flex>
  )
}
