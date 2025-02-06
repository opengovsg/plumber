import { InputGroup } from '@chakra-ui/react'

import ExecutionStatusMenu from '@/components/ExecutionStatusMenu'

interface StatusInputProps {
  status: string
  onStatusChange: (newStatus: string) => void
}

export default function StatusInput({
  status,
  onStatusChange,
}: StatusInputProps) {
  return (
    <InputGroup
      border="1px solid"
      borderColor={'base.divider.strong'}
      borderRadius="4px"
      display="flex"
      alignItems="center"
      justifyContent="flex-end"
      maxW="fit-content"
      ml="auto"
    >
      <ExecutionStatusMenu
        filterStatus={status}
        onFilterChange={onStatusChange}
      />
    </InputGroup>
  )
}
