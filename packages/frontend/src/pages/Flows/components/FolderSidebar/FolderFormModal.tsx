import { FormEvent, useEffect, useState } from 'react'
import {
  Box,
  Flex,
  FormControl,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from '@chakra-ui/react'
import { Button, FormLabel, Input } from '@opengovsg/design-system-react'

import {
  DEFAULT_FOLDER_COLOR,
  FOLDER_COLOR_KEYS,
  FOLDER_COLORS,
  FolderColor,
} from './constants'
import { FolderSummary } from './FolderRow'

const MAX_FOLDER_NAME_LENGTH = 60

export interface FolderFormModalProps {
  isOpen: boolean
  // Omit (or pass null) to create a new folder. Pass an existing folder to
  // rename it or change its colour — both actions share this dialog.
  folder?: FolderSummary | null
  isSubmitting?: boolean
  onClose: () => void
  onSubmit: (values: { name: string; color: FolderColor }) => void
}

export default function FolderFormModal(props: FolderFormModalProps) {
  const { isOpen, folder, isSubmitting = false, onClose, onSubmit } = props
  const isRenameMode = !!folder

  const [name, setName] = useState(folder?.name ?? '')
  const [color, setColor] = useState<FolderColor>(
    folder?.color ?? DEFAULT_FOLDER_COLOR,
  )

  // Re-seed the form from `folder` every time the dialog opens, in case the
  // caller keeps this component mounted between opens.
  useEffect(() => {
    if (!isOpen) {
      return
    }
    setName(folder?.name ?? '')
    setColor(folder?.color ?? DEFAULT_FOLDER_COLOR)
  }, [isOpen, folder?.name, folder?.color])

  const trimmedName = name.trim()
  const isNameValid = trimmedName.length > 0

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isNameValid) {
      return
    }
    onSubmit({ name: trimmedName, color })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} motionPreset="none" isCentered>
      <ModalOverlay bg="base.canvas.overlay" />
      <ModalContent>
        <form onSubmit={handleSubmit}>
          <ModalHeader>
            {/* Neutral label: this same dialog is opened from both the
                "Rename" and "Change colour" menu items, so it shouldn't
                claim to be renaming when the user only wants a new colour. */}
            {isRenameMode ? 'Edit folder' : 'New folder'}
          </ModalHeader>
          <ModalBody>
            <Flex flexDir="column" rowGap={4}>
              <FormControl isRequired>
                <FormLabel textStyle="subhead-1">Folder name</FormLabel>
                <Input
                  autoFocus
                  value={name}
                  maxLength={MAX_FOLDER_NAME_LENGTH}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="For e.g. Grant disbursements"
                  required
                />
              </FormControl>

              <FormControl>
                <FormLabel textStyle="subhead-1">Colour</FormLabel>
                <Flex gap={3} role="group" aria-label="Folder colour">
                  {FOLDER_COLOR_KEYS.map((colorKey) => {
                    const isSelected = colorKey === color
                    const colorToken = FOLDER_COLORS[colorKey]
                    return (
                      <Box
                        key={colorKey}
                        as="button"
                        type="button"
                        onClick={() => setColor(colorKey)}
                        aria-pressed={isSelected}
                        aria-label={
                          isSelected
                            ? `${colorToken.label}, selected`
                            : colorToken.label
                        }
                        boxSize="22px"
                        borderRadius="full"
                        bg={colorToken.dot}
                        outline={isSelected ? '2px solid' : 'none'}
                        outlineColor="primary.500"
                        outlineOffset="2px"
                        cursor="pointer"
                      />
                    )
                  })}
                </Flex>
              </FormControl>
            </Flex>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button
              variant="clear"
              colorScheme="secondary"
              onClick={onClose}
              isDisabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isDisabled={!isNameValid}
              isLoading={isSubmitting}
            >
              {isRenameMode ? 'Save changes' : 'Create folder'}
            </Button>
          </ModalFooter>
        </form>
        <ModalCloseButton />
      </ModalContent>
    </Modal>
  )
}
