import { KeyboardEvent, useState } from 'react'
import { FaCheck, FaTimes } from 'react-icons/fa'
import { MdOutlineModeEdit } from 'react-icons/md'
import { Flex, Text } from '@chakra-ui/react'
import { IconButton, Input, useIsMobile } from '@opengovsg/design-system-react'

interface EditableInputProps {
  value: string
  onSave: (value: string) => Promise<void>
  readOnly?: boolean
  maxLength?: number
  width?: string | string[]
  editModeWrapper?: (children: React.ReactNode) => React.ReactNode
  readOnlyWrapper?: (children: React.ReactNode) => React.ReactNode
  componentWrapper?: (children: React.ReactNode) => React.ReactNode
  allowEmpty?: boolean
  placeholder?: string
}

export default function EditableInput({
  value: initialValue,
  onSave,
  readOnly = false,
  maxLength = 64,
  width = ['100%', '300px', '400px', '500px'],
  editModeWrapper,
  readOnlyWrapper,
  componentWrapper,
  placeholder,
  allowEmpty = false,
}: EditableInputProps) {
  const isMobile = useIsMobile()

  const [isEditing, setIsEditing] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [inputValue, setInputValue] = useState(initialValue)

  const resetField = () => {
    setIsEditing(false)
    setInputValue(initialValue)
  }

  const handleSave = async () => {
    const trimmedValue = inputValue.trim()
    if (
      !allowEmpty &&
      (!trimmedValue.length || trimmedValue.length > maxLength)
    ) {
      resetField()
    } else {
      const valueToSave = trimmedValue === '' ? '' : trimmedValue
      setIsUpdating(true)
      await onSave(valueToSave)
      setIsUpdating(false)
      setIsEditing(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave()
    }
    if (e.key === 'Escape') {
      resetField()
    }
  }

  const editModeContent = (
    <Flex width="100%">
      <Input
        autoFocus
        w={width}
        maxLength={maxLength}
        variant="flushed"
        value={inputValue}
        onKeyDown={handleKeyDown}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
      />
      <IconButton
        ml={3}
        icon={<FaCheck size={14} />}
        aria-label="Save"
        isLoading={isUpdating}
        onClick={handleSave}
        variant="clear"
        size="xs"
      />
      <IconButton
        icon={<FaTimes size={14} />}
        aria-label="Cancel"
        isDisabled={isUpdating}
        onClick={() => resetField()}
        size="xs"
        variant="clear"
        colorScheme="secondary"
      />
    </Flex>
  )

  const readOnlyContent = (
    <Flex
      alignItems="center"
      gap={3}
      onClick={() => {
        if (!readOnly) {
          setInputValue(initialValue)
          setIsEditing(true)
        }
      }}
      whiteSpace="nowrap"
      maxW={isMobile ? '80%' : '100%'}
    >
      <Text
        textOverflow="ellipsis"
        overflow="hidden"
        w={isMobile ? width : 'auto'}
      >
        {initialValue}
      </Text>
      {!readOnly && (
        <IconButton
          onClick={() => {
            setInputValue(initialValue)
            setIsEditing(true)
          }}
          icon={<MdOutlineModeEdit size={14} />}
          aria-label="Edit"
          size="xs"
          variant="clear"
          display={isMobile ? 'flex' : 'none'}
          _groupHover={{
            display: 'flex',
          }}
        />
      )}
    </Flex>
  )

  const wrappedEditModeContent = editModeWrapper
    ? editModeWrapper(editModeContent)
    : editModeContent

  const wrappedReadOnlyContent = readOnlyWrapper
    ? readOnlyWrapper(readOnlyContent)
    : readOnlyContent

  const wrappedChildren = componentWrapper
    ? componentWrapper(
        isEditing ? wrappedEditModeContent : wrappedReadOnlyContent,
      )
    : isEditing
    ? wrappedEditModeContent
    : wrappedReadOnlyContent

  return (
    <Flex
      alignItems="center"
      gap={3}
      cursor={readOnly ? 'default' : 'pointer'}
      role="group"
      width="100%"
    >
      {wrappedChildren}
    </Flex>
  )
}

// example of wrapper
// <EditableInput
//   value="Some text"
//   onSave={async (newValue) => {
//     // Handle saving the new value
//   }}
//   readOnly={false}
//   maxLength={64}
//   width="500px"
//   readOnlyWrapper={(children) => <CustomWrapper>{children}</CustomWrapper>}
// />
