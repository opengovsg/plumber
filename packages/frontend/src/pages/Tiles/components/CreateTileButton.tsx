import { ITableMetadata } from '@plumber/types'

import { useCallback, useState } from 'react'
import { BiSpreadsheet, BiTable } from 'react-icons/bi'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import {
  Flex,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import {
  Button,
  FormLabel,
  Input,
  ModalCloseButton,
  Tile,
} from '@opengovsg/design-system-react'
import * as URLS from 'config/urls'
import { CREATE_TABLE } from 'graphql/mutations/tiles/create-table'
import { ImportCsvModalContent } from 'pages/Tile/components/TableBanner/ImportCsvButton'
import { TableContextProvider } from 'pages/Tile/contexts/TableContext'

type TILE_CREATE_MODE = 'import' | 'new'

const CreateTileForm = ({
  tableName,
  setTableName,
  onSubmit,
  isSubmitting,
  onImportNext,
}: {
  tableName: string
  setTableName: (tableName: string) => void
  onSubmit: () => Promise<void>
  isSubmitting: boolean
  onImportNext: () => void
}) => {
  const [createMode, setCreateMode] = useState<TILE_CREATE_MODE | null>(null)

  return (
    <>
      <ModalHeader>Create a Tile</ModalHeader>
      <ModalCloseButton />
      <ModalBody>
        <FormLabel isRequired>Enter a name for your new tile</FormLabel>
        <Input
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
        />
        <FormLabel mt={8} isRequired>
          How do you want to start?
        </FormLabel>
        <Flex gap={4}>
          <Tile
            icon={BiSpreadsheet}
            flex={1}
            onClick={() => setCreateMode('import')}
            isSelected={createMode === 'import'}
          >
            <Text textStyle="h5" mt={4}>
              Import CSV
            </Text>
            <Text textStyle="body-2">
              Start with data that you have already collected
            </Text>
          </Tile>
          <Tile
            icon={BiTable}
            flex={1}
            onClick={() => setCreateMode('new')}
            isSelected={createMode === 'new'}
          >
            <Text textStyle="h5" mt={4}>
              Start from scratch
            </Text>
            <Text textStyle="body-2">Start with a blank database</Text>
          </Tile>
        </Flex>
      </ModalBody>
      <ModalFooter>
        <Button
          colorScheme="primary"
          isLoading={isSubmitting}
          onClick={createMode === 'new' ? onSubmit : onImportNext}
          isDisabled={createMode == null || tableName?.length === 0}
        >
          {createMode === 'import' ? 'Next' : 'Create'}
        </Button>
      </ModalFooter>
    </>
  )
}

const CreateTileModal = ({ onClose }: { onClose: () => void }): JSX.Element => {
  const navigate = useNavigate()
  const [tableName, setTableName] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [tableData, setTableData] = useState<ITableMetadata | null>(null)

  const [createTableMutation, { loading }] = useMutation<{
    createTable: ITableMetadata
  }>(CREATE_TABLE)

  const createTable = useCallback(
    async ({ isBlank }: { isBlank: boolean }) => {
      const { data } = await createTableMutation({
        variables: {
          input: {
            name: tableName,
            isBlank,
          },
        },
      })
      if (!data?.createTable) {
        return
      }
      setTableData(data.createTable)
      return data.createTable
    },
    [createTableMutation, tableName],
  )

  const navigateToTile = useCallback(
    (tileId?: string) => {
      if (!tileId) {
        return
      }
      navigate(URLS.TILE(tileId as string))
      onClose()
    },
    [navigate, onClose],
  )

  const onSubmit = useCallback(async () => {
    const data = await createTable({ isBlank: false })
    navigateToTile(data?.id)
  }, [createTable, navigateToTile])

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      closeOnOverlayClick={false}
      closeOnEsc={false}
    >
      <ModalOverlay />
      <ModalContent>
        {showImportModal ? (
          <TableContextProvider
            tableName={tableName}
            tableId={tableData ? tableData.id : ''}
            tableColumns={[]}
            tableRows={[]}
          >
            <ImportCsvModalContent
              onPreImport={() => createTable({ isBlank: true })}
              onClose={onClose}
              onPostImport={() => navigateToTile(tableData?.id)}
              onBack={() => setShowImportModal(false)}
            />
          </TableContextProvider>
        ) : (
          <CreateTileForm
            tableName={tableName}
            setTableName={setTableName}
            onSubmit={onSubmit}
            isSubmitting={loading}
            onImportNext={() => setShowImportModal(true)}
          />
        )}
      </ModalContent>
    </Modal>
  )
}

const CreateTileButton = (): JSX.Element => {
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <>
      <Button onClick={onOpen}>Create Tile</Button>
      {isOpen && <CreateTileModal onClose={onClose} />}
    </>
  )
}

export default CreateTileButton
