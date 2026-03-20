import type { DropdownAddNewId, ITableColumnMetadata } from '@plumber/types'

import { type FormEvent, useCallback, useContext, useState } from 'react'
import { useMutation } from '@apollo/client'
import {
  FormControl,
  FormHelperText,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
} from '@chakra-ui/react'
import {
  Button,
  FormErrorMessage,
  FormLabel,
  Input,
} from '@opengovsg/design-system-react'

import { removeProblematicWhitespace } from '@/components/RichTextEditor/utils'
import { EditorContext } from '@/contexts/Editor'
import client from '@/graphql/client'
import { DYNAMIC_ACTION } from '@/graphql/mutations/dynamic-action'
import { CREATE_TABLE } from '@/graphql/mutations/tiles/create-table'
import { UPDATE_TABLE } from '@/graphql/mutations/tiles/update-table'
import { GET_DYNAMIC_DATA } from '@/graphql/queries/get-dynamic-data'

interface AddNewOptionConfig {
  modalHeader: string
  description?: string
  inputLabel: string
  buttonLabel: string
  validate?: (value: string) => string | null
}

const MAX_NAME_LENGTH = 255

function validateMaxLength(value: string): string | null {
  if (value.length > MAX_NAME_LENGTH) {
    return `Must be ${MAX_NAME_LENGTH} characters or fewer`
  }
  return null
}

function validateDatabricksTableName(value: string): string | null {
  const lengthError = validateMaxLength(value)
  if (lengthError) {
    return lengthError
  }
  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    return 'Only alphanumeric characters and underscores are allowed'
  }
  return null
}

function validateColumnName(value: string): string | null {
  const lengthError = validateMaxLength(value)
  if (lengthError) {
    return lengthError
  }
  if (!/^[a-zA-Z0-9 _\-!@#$%^&*()+=[\]{};:'",.<>/?|~]+$/.test(value)) {
    return 'Only alphanumeric characters, spaces, and common special characters are allowed'
  }
  return null
}

const ADD_NEW_OPTION_CONFIGS: Partial<
  Record<DropdownAddNewId, AddNewOptionConfig>
> = {
  'tiles-createTileRow-tableId': {
    modalHeader: 'Create a new tile',
    inputLabel: 'Name your new table',
    buttonLabel: 'Create',
    validate: validateMaxLength,
  },
  'databricks-createTable': {
    modalHeader: 'Create a new table',
    inputLabel: 'Table name',
    description: 'Only lowercase letters, numbers and underscores allowed.',
    buttonLabel: 'Create',
    validate: validateDatabricksTableName,
  },
}

// Validation for inline add-new options (non-modal)
export const INLINE_ADD_NEW_VALIDATE: Partial<
  Record<DropdownAddNewId, (value: string) => string | null>
> = {
  'tiles-createTileRow-columnId': validateColumnName,
  'databricks-createTableColumn': validateColumnName,
}

interface AddNewOptionalModalProps {
  addNewId: DropdownAddNewId
  onSubmit: (newValue: string) => void
  onClose: () => void
}

interface CreateNewOptionProps {
  inputValue: string
  parameters: Record<string, unknown>
  addNewId?: DropdownAddNewId
}

export function useCreateNewOption(setValue: (newValue: string) => void) {
  const { currentStepId } = useContext(EditorContext)
  const [createTable] = useMutation(CREATE_TABLE)
  const [updateTable] = useMutation(UPDATE_TABLE)
  const [dynamicAction] = useMutation(DYNAMIC_ACTION)
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

          case 'databricks-createTable': {
            if (!currentStepId) {
              return
            }
            const { data } = await dynamicAction({
              variables: {
                input: {
                  stepId: currentStepId ?? '',
                  key: addNewId,
                  parameters: {
                    tableName: inputValue.trim(),
                  },
                },
              },
            })
            newValue = data?.dynamicAction?.newValue as string
            break
          }
          case 'databricks-createTableColumn': {
            const tableName = parameters?.tableName as string
            if (!tableName || !currentStepId) {
              return
            }
            const { data } = await dynamicAction({
              variables: {
                input: {
                  stepId: currentStepId ?? '',
                  key: addNewId,
                  parameters: {
                    tableName: parameters?.tableName as string,
                    columnName: inputValue.trim(),
                  },
                },
              },
            })
            newValue = data?.dynamicAction?.newValue as string
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
    [createTable, setValue, updateTable, dynamicAction, currentStepId],
  )
  return { createNewOption, isCreatingNewOption }
}

function AddNewOptionalModal({
  addNewId,
  onClose,
  onSubmit,
}: AddNewOptionalModalProps) {
  const config = ADD_NEW_OPTION_CONFIGS[addNewId]
  const [inputValue, setInputValue] = useState('')
  const trimmedInputValue = inputValue.trim()

  const validationError = trimmedInputValue
    ? config?.validate?.(trimmedInputValue) ?? null
    : null

  const onFormSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!trimmedInputValue) {
        return
      }
      if (config?.validate?.(trimmedInputValue)) {
        return
      }
      onSubmit(trimmedInputValue)
    },
    [onSubmit, trimmedInputValue, config],
  )

  if (!config) {
    return null
  }

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
          <ModalHeader>{config.modalHeader}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={8}>
            <FormControl
              display="flex"
              flexDir="column"
              gap={2}
              isInvalid={!!validationError}
            >
              <FormLabel isRequired>{config.inputLabel}</FormLabel>
              {config.description && (
                <FormHelperText mt={-2}>{config.description}</FormHelperText>
              )}
              <Input
                autoFocus
                onChange={(e) =>
                  setInputValue(removeProblematicWhitespace(e.target.value))
                }
                value={inputValue}
              />
              {validationError && (
                <FormErrorMessage>{validationError}</FormErrorMessage>
              )}
              <Button
                mt={2}
                type="submit"
                isDisabled={!trimmedInputValue || !!validationError}
                alignSelf="flex-end"
              >
                {config.buttonLabel}
              </Button>
            </FormControl>
          </ModalBody>
        </form>
      </ModalContent>
    </Modal>
  )
}

export default AddNewOptionalModal
