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
      variant="clear"
      colorScheme="red"
      isLoading={isDeletingColumns}
      onClick={() => deleteColumns([id])}
    >
      Delete column
    </Button>
  )
}
