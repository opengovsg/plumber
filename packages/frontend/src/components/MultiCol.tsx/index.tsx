import type { IFieldMultiRowMultiColSubField } from '@plumber/types'

import { BiTrash } from 'react-icons/bi'
import { Flex, useBreakpointValue } from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import InputCreator from '@/components/InputCreator'

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

  const isMobile = useBreakpointValue({ base: true, sm: false })
  return (
    <Flex flexDir={isMobile ? 'column' : 'row'} gap={2} alignItems="center">
      {subFields.map((subF, subFIndex) => {
        const { type, variables } = subF
        return (
          <div
            key={`${name}.${subF.key}`}
            style={isMobile ? { flex: 1, width: '100%' } : subF.customStyle}
          >
            <InputCreator
              schema={subF}
              namePrefix={name}
              parentType="multicol"
              autoFocus={subFIndex === 0 && type === 'string' && variables}
              {...forwardedInputCreatorProps}
            />
          </div>
        )
      })}
      {canRemoveRow && (
        <IconButton
          variant="clear"
          aria-label="Remove"
          icon={<BiTrash />}
          isDisabled={isEditorReadOnly}
          onClick={() => remove?.(index)}
          colorScheme="secondary"
        />
      )}
    </Flex>
  )
}
