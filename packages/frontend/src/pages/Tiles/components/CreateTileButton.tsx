import { ITableMetadata } from '@plumber/types'

import { FormEvent, useCallback, useContext, useState } from 'react'
import { HiOutlineHandRaised } from 'react-icons/hi2'
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
import { TILES_FEATURE_FLAG } from 'config/flags'
import * as URLS from 'config/urls'
import { LaunchDarklyContext } from 'contexts/LaunchDarkly'
import { CREATE_TABLE } from 'graphql/mutations/create-table'

const CreateTileButton = (): JSX.Element => {
  /**
   * Check if feature flag is enabled, otherwise dont allow creation
   * eventually, this should be removed
   */
  const { flags } = useContext(LaunchDarklyContext)
  const isTilesEnabled = flags?.[TILES_FEATURE_FLAG]

  const { isOpen, onOpen, onClose } = useDisclosure()
  const navigate = useNavigate()

  const [tableName, setTableName] = useState('')

  const [createTable, { loading }] = useMutation<{
    createTable: ITableMetadata
  }>(CREATE_TABLE)

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      const { data } = await createTable({
        variables: {
          input: {
            name: tableName,
          },
        },
      })
      navigate(URLS.TILE(data?.createTable.id as string))
      onClose()
    },
    [createTable, tableName, navigate, onClose],
  )

  return (
    <>
      {isTilesEnabled ? (
        <Button onClick={onOpen}>Create Tile</Button>
      ) : (
        <Button
          p={2}
          px={4}
          onClick={() =>
            window.open(URLS.TILES_REQUEST_ACCCESS_FORM_LINK, '_blank')
          }
          leftIcon={<HiOutlineHandRaised size={20} />}
        >
          Request access
        </Button>
      )}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <form onSubmit={onSubmit}>
            <ModalHeader>Tiles</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <FormLabel isRequired>Enter a name for your new tile</FormLabel>
              <Input
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
              />
            </ModalBody>
            <ModalFooter>
              <Button type="submit" colorScheme="primary" isLoading={loading}>
                Confirm
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  )
}

export default CreateTileButton
