import { BsTrash } from 'react-icons/bs'
import { Button } from '@opengovsg/design-system-react'

import { useUpdateTable } from '../../hooks/useUpdateTable'

interface DeleteColumnButtonProps {
  id: string
}

export default function DeleteColumnButton({ id }: DeleteColumnButtonProps) {
  const { deleteColumns, isDeletingColumns } = useUpdateTable()

  return (
    <Button
      leftIcon={<BsTrash />}
      variant="link"
      py={2}
      color="utility.feedback.critical"
      _hover={{
        color: 'red.400',
      }}
      isLoading={isDeletingColumns}
      onClick={() => deleteColumns([id])}
    >
      Delete column
    </Button>
  )
}
