import { useCallback, useState } from 'react'
import { MdCheck, MdEdit } from 'react-icons/md'
import { Flex, Text } from '@chakra-ui/react'
import { IconButton, Input } from '@opengovsg/design-system-react'

import { useUpdateTable } from '../../hooks/useUpdateTable'

interface EditColumnNameProps {
  id: string
  columnName: string
}

export default function EditColumnName({
  id,
  columnName,
}: EditColumnNameProps) {
  const [newColumnName, setNewColumnName] = useState(columnName)
  const [isEditingColumnName, setIsEditingColumnName] = useState(false)
  const { updateColumns, isUpdatingColumns } = useUpdateTable()

  const onSave = useCallback(async () => {
    const trimmedNewColumnName = newColumnName.trim()
    if (!trimmedNewColumnName.length) {
      return
    }
    await updateColumns([{ id, name: trimmedNewColumnName }])
    setIsEditingColumnName(false)
  }, [newColumnName, updateColumns, id])

  return (
    <Flex gap={1} w="100%" alignItems="center" justifyContent="space-between">
      {isEditingColumnName ? (
        <>
          <Input
            size="sm"
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSave()
              }
            }}
            onBlur={onSave}
          />
          <IconButton
            aria-label="save"
            size="sm"
            variant="clear"
            icon={<MdCheck />}
            isLoading={isUpdatingColumns}
            onClick={onSave}
          />
        </>
      ) : (
        <>
          <Text textStyle="subhead-2" wordBreak="break-word">
            {columnName}
          </Text>
          <IconButton
            alignSelf="flex-start"
            aria-label="edit"
            size="sm"
            variant="clear"
            icon={<MdEdit />}
            onClick={() => setIsEditingColumnName(true)}
          />
        </>
      )}
    </Flex>
  )
}
