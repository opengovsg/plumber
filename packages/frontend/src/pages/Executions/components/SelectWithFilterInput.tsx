import { useEffect, useState } from 'react'
import { Box, Divider, InputGroup } from '@chakra-ui/react'

import ExecutionStatusMenu from '@/components/ExecutionStatusMenu'
import { SingleSelect } from '@/components/SingleSelect/SingleSelect'

interface SelectWithFilterInputProps {
  status: string
  searchValue?: string
  onChange?: (val: string) => void
  onStatusChange: (newStatus: string) => void
  items: { value: string; label: string }[]
  loading: boolean
}

export default function SelectWithFilterInput({
  status,
  searchValue = '',
  onChange,
  onStatusChange,
  items,
  loading,
}: SelectWithFilterInputProps) {
  const [selectedItem, setSelectedItem] = useState<string>('')

  useEffect(() => {
    if (searchValue) {
      setSelectedItem(searchValue)
    }
  }, [searchValue])

  return (
    <InputGroup
      border="1px solid"
      borderColor={'base.divider.strong'}
      borderRadius="4px"
      display="flex"
      alignItems="center"
    >
      <Box flex={1}>
        <SingleSelect
          name="select-pipe"
          colorScheme="primary"
          placeholder="Select Pipe"
          isDisabled={loading}
          items={items}
          value={selectedItem}
          onChange={(e) => {
            setSelectedItem(e)
            onChange?.(e)
          }}
          isClearable={false}
          size="sm"
          variant="borderless"
        />
      </Box>
      <Divider
        borderColor="base.divider.medium"
        h={5}
        mx={1}
        orientation="vertical"
      />
      <ExecutionStatusMenu
        filterStatus={status}
        onFilterChange={onStatusChange}
      />
    </InputGroup>
  )
}
