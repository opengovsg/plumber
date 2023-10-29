import { ITableMetadata } from '@plumber/types'

import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
} from '@chakra-ui/react'
import {
  Button,
  FormLabel,
  Input,
  ModalCloseButton,
} from '@opengovsg/design-system-react'
import * as URLS from 'config/urls'
import { CREATE_TABLE } from 'graphql/mutations/create-table'

const CreateTileButton = (): JSX.Element => {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const navigate = useNavigate()

  const [tableName, setTableName] = useState('')

  const [createTable, { loading }] = useMutation<ITableMetadata>(CREATE_TABLE)

  const onSubmit = useCallback(async () => {
    const { data } = await createTable({
      variables: {
        input: {
          name: tableName,
        },
      },
    })
    navigate(URLS.TILE(data?.id as string))
    onClose()
  }, [createTable, tableName, navigate, onClose])

  return (
    <>
      <Button onClick={onOpen}>Create Tile</Button>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Tiles</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormLabel isRequired>Enter a name for your new tiles.</FormLabel>
            <Input
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              onClick={onSubmit}
              colorScheme="primary"
              isLoading={loading}
            >
              Confirm
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}

export default CreateTileButton
