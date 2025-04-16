import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from 'react'
import { BiCopy, BiTrash } from 'react-icons/bi'
import {
  Icon,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Portal,
} from '@chakra-ui/react'
import { useToast } from '@opengovsg/design-system-react'

import DeleteRowsModal from '../components/TableFooter/DeleteRowsModal'

interface ContextMenuContextProps {
  onRightClick: (rowId: string, pos: [number, number]) => void
  onDeleteRows: () => void
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
  const [rowIdsSelected, setRowIdsSelected] = useState<string[]>([])
  const toast = useToast({
    title: 'Row ID copied to clipboard',
    description: 'You can use this in the Update single row step',
    status: 'success',
    isClosable: true,
  })

  const rowsSelected = Object.keys(rowSelection)

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  const onRightClick = useCallback(
    (rowId: string, pos: [number, number]) => {
      setPosition(pos)
      if (!rowsSelected.includes(rowId)) {
        clearRowSelection()
        setRowIdsSelected([rowId])
      } else {
        setRowIdsSelected(rowsSelected)
      }
    },
    [clearRowSelection, rowsSelected],
  )

  const onDeleteRows = useCallback(() => {
    setRowIdsSelected(rowsSelected)
    setIsDeleteModalOpen(true)
  }, [rowsSelected])

  const onRowIdCopy = useCallback(
    (rowId: string) => {
      navigator.clipboard.writeText(rowId)
      toast()
    },
    [toast],
  )

  return (
    <ContextMenuContext.Provider
      value={{
        onRightClick,
        onDeleteRows,
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
            <MenuList m={0} gap={1} display="flex" flexDir="column">
              {rowsSelected.length <= 1 && (
                <MenuItem
                  icon={<Icon as={BiCopy} boxSize={5} />}
                  display="flex"
                  alignItems="center"
                  onClick={() => onRowIdCopy(rowIdsSelected[0])}
                >
                  Copy row ID
                </MenuItem>
              )}
              <MenuItem
                icon={<Icon as={BiTrash} boxSize={5} />}
                color="interaction.critical.default"
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
          rowIdsToDelete={rowIdsSelected}
        />
      )}
    </ContextMenuContext.Provider>
  )
}
