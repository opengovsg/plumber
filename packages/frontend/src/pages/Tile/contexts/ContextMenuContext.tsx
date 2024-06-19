import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from 'react'
import { BsTrash } from 'react-icons/bs'
import { Menu, MenuButton, MenuItem, MenuList, Portal } from '@chakra-ui/react'

import DeleteRowsModal from '../components/TableFooter/DeleteRowsModal'

interface ContextMenuContextProps {
  onRightClick: (rowId: string, pos: [number, number]) => void
  onDeleteRows: (rowIdsToDelete: string[]) => void
}

const ContextMenuContext = createContext<ContextMenuContextProps | null>(null)

export const useContextMenuContext = () => {
  const context = useContext(ContextMenuContext)
  if (!context) {
    return {} as ContextMenuContextProps
  }
  return context
}

interface ContextMenuContextProviderProps {
  clearRowSelection: () => void
  rowSelection: Record<string, boolean>
  removeRows: (rowIds: string[]) => void
  children: ReactNode
}

export const ContextMenuContextProvider = ({
  rowSelection,
  clearRowSelection,
  removeRows,
  children,
}: ContextMenuContextProviderProps) => {
  const [position, setPosition] = useState<[number, number] | null>(null)
  const [rowIdsToDelete, setRowIdsToDelete] = useState<string[]>([])

  const rowsSelected = Object.keys(rowSelection)

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  const onRightClick = useCallback(
    (rowId: string, pos: [number, number]) => {
      setPosition(pos)
      if (!rowsSelected.includes(rowId)) {
        clearRowSelection()
        setRowIdsToDelete([rowId])
      } else {
        setRowIdsToDelete(rowsSelected)
      }
    },
    [clearRowSelection, rowsSelected],
  )

  return (
    <ContextMenuContext.Provider
      value={{
        onRightClick,
        onDeleteRows: () => setIsDeleteModalOpen(true),
      }}
    >
      {children}
      <Portal>
        {position && (
          <Menu
            isOpen
            isLazy
            gutter={0}
            closeOnBlur
            onClose={() => setPosition(null)}
          >
            <MenuButton
              aria-hidden={true}
              w={0}
              h={0}
              position="absolute"
              left={position[0]}
              top={position[1]}
            />
            <MenuList m={0}>
              <MenuItem
                icon={<BsTrash size={16} />}
                color="red.500"
                onClick={() => setIsDeleteModalOpen(true)}
              >
                {rowsSelected.length ? 'Delete selected rows' : 'Delete row'}
              </MenuItem>
            </MenuList>
          </Menu>
        )}
      </Portal>
      {isDeleteModalOpen && (
        <DeleteRowsModal
          removeRows={removeRows}
          onClose={() => setIsDeleteModalOpen(false)}
          rowIdsToDelete={rowIdsToDelete}
        />
      )}
    </ContextMenuContext.Provider>
  )
}
