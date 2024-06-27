import { IFieldDropdown } from '@plumber/types'

import { FormEvent, useCallback, useState } from 'react'
import { useMutation } from '@apollo/client'
import {
  FormControl,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
} from '@chakra-ui/react'
import { Button, FormLabel, Input } from '@opengovsg/design-system-react'
import client from 'graphql/client'
import { CREATE_TABLE } from 'graphql/mutations/tiles/create-table'
import { GET_DYNAMIC_DATA } from 'graphql/queries/get-dynamic-data'

interface AddNewOptionalModalProps {
  addNewOption: NonNullable<IFieldDropdown['addNewOption']>
  onSubmit: (newValue: string) => void
  onClose: () => void
}

function AddNewOptionalModal({
  addNewOption: { id: addNewId, label },
  onClose,
  onSubmit,
}: AddNewOptionalModalProps) {
  const [createTable] = useMutation(CREATE_TABLE)
  const [isMutatingLoading, setIsMutationLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const trimmedInputValue = inputValue.trim()

  const onFormSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!trimmedInputValue) {
        return
      }
      setIsMutationLoading(true)
      try {
        let newValue: string | undefined
        switch (addNewId) {
          case 'tiles-createTileRow-tableId': {
            const { data } = await createTable({
              variables: {
                input: {
                  name: trimmedInputValue,
                  isBlank: true,
                },
              },
            })
            newValue = data?.createTable.id
            break
          }
          default:
            break
        }
        await client.refetchQueries({ include: [GET_DYNAMIC_DATA] })
        if (newValue) {
          onSubmit(newValue)
        }
        onClose()
      } finally {
        setIsMutationLoading(false)
      }
    },
    [addNewId, createTable, onClose, onSubmit, trimmedInputValue],
  )

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      size="md"
      closeOnEsc={false}
      motionPreset="none"
    >
      <ModalOverlay />
      <ModalContent>
        <form onSubmit={onFormSubmit}>
          <ModalHeader>{label}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={8}>
            <FormControl display="flex" flexDir="column" gap={2}>
              <FormLabel isRequired>Name your tile</FormLabel>
              <Input
                autoFocus
                onChange={(e) => setInputValue(e.target.value)}
                value={inputValue}
                isDisabled={isMutatingLoading}
              />
              <Button
                mt={2}
                type="submit"
                isDisabled={!trimmedInputValue}
                isLoading={isMutatingLoading}
                alignSelf="flex-end"
              >
                Create
              </Button>
            </FormControl>
          </ModalBody>
        </form>
      </ModalContent>
    </Modal>
  )
}

export default AddNewOptionalModal
