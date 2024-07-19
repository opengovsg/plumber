import type { DropdownAddNewId, ITableColumnMetadata } from '@plumber/types'

import { type FormEvent, useCallback, useState } from 'react'
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

import client from '@/graphql/client'
import { CREATE_TABLE } from '@/graphql/mutations/tiles/create-table'
import { UPDATE_TABLE } from '@/graphql/mutations/tiles/update-table'
import { GET_DYNAMIC_DATA } from '@/graphql/queries/get-dynamic-data'

interface AddNewOptionalModalProps {
  modalHeader: string
  onSubmit: (newValue: string) => void
  onClose: () => void
}

interface CreateNewOptionProps {
  inputValue: string
  parameters: Record<string, unknown>
  addNewId?: DropdownAddNewId
}

export function useCreateNewOption(setValue: (newValue: string) => void) {
  const [createTable] = useMutation(CREATE_TABLE)
  const [updateTable] = useMutation(UPDATE_TABLE)
  const [isCreatingNewOption, setIsCreatingNewOption] = useState(false)
  const createNewOption = useCallback(
    async ({ inputValue, addNewId, parameters }: CreateNewOptionProps) => {
      if (!inputValue.trim() || !addNewId) {
        return
      }
      let newValue: string | undefined
      setIsCreatingNewOption(true)
      try {
        switch (addNewId) {
          case 'tiles-createTileRow-tableId': {
            const { data } = await createTable({
              variables: {
                input: {
                  name: inputValue.trim(),
                  isBlank: true,
                },
              },
            })
            newValue = data?.createTable.id
            break
          }
          case 'tiles-createTileRow-columnId': {
            const tableId = parameters?.tableId
            if (!tableId || typeof tableId !== 'string') {
              return
            }
            const { data } = await updateTable({
              variables: {
                input: {
                  id: tableId,
                  addedColumns: [inputValue],
                },
              },
            })
            const newColumns = (data?.updateTable?.columns ??
              []) as ITableColumnMetadata[]
            newValue = newColumns.find(
              (column) => column.name === inputValue,
            )?.id
            break
          }
          default:
            break
        }
        await client.refetchQueries({ include: [GET_DYNAMIC_DATA] })
        if (newValue) {
          setValue(newValue)
        }
      } finally {
        setIsCreatingNewOption(false)
      }
    },
    [createTable, setValue, updateTable],
  )
  return { createNewOption, isCreatingNewOption }
}

function AddNewOptionalModal({
  modalHeader,
  onClose,
  onSubmit,
}: AddNewOptionalModalProps) {
  const [inputValue, setInputValue] = useState('')
  const trimmedInputValue = inputValue.trim()

  const onFormSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!trimmedInputValue) {
        return
      }
      onSubmit(trimmedInputValue)
    },
    [onSubmit, trimmedInputValue],
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
          <ModalHeader>{modalHeader}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={8}>
            <FormControl display="flex" flexDir="column" gap={2}>
              {/* This is hardcoded for now, will change when there are more of such actions */}
              <FormLabel isRequired>Name your tile</FormLabel>
              <Input
                autoFocus
                onChange={(e) => setInputValue(e.target.value)}
                value={inputValue}
              />
              <Button
                mt={2}
                type="submit"
                isDisabled={!trimmedInputValue}
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
