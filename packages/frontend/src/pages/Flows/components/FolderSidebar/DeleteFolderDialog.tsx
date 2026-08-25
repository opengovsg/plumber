import { useRef } from 'react'

import MenuAlertDialog from '@/components/MenuAlertDialog'

import { FolderSummary } from './FolderRow'

export interface DeleteFolderDialogProps {
  isOpen: boolean
  // The folder pending deletion. The dialog renders nothing while this is
  // null, so callers can keep it mounted and simply swap this prop.
  folder: FolderSummary | null
  isDeleting?: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function DeleteFolderDialog(props: DeleteFolderDialogProps) {
  const { isOpen, folder, isDeleting = false, onClose, onConfirm } = props
  const cancelRef = useRef<HTMLButtonElement>(null)

  if (!folder) {
    return null
  }

  return (
    <MenuAlertDialog
      isDialogOpen={isOpen}
      cancelRef={cancelRef}
      onDialogClose={onClose}
      dialogHeader="Folder"
      dialogType="delete"
      onClick={onConfirm}
      isLoading={isDeleting}
      customBody={`Deleting **${folder.name}** will not delete the pipes inside it. They'll move to **Unfiled**, and this can't be undone.`}
    />
  )
}
