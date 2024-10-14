import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BiSearch, BiSolidXCircle } from 'react-icons/bi'
import {
  Divider,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
} from '@chakra-ui/react'
import { debounce } from 'lodash'

import ExecutionStatusMenu from '@/components/ExecutionStatusMenu'

interface SearchWithFilterInputProps {
  status: string
  searchValue: string
  onChange: (val: string) => void
  onStatusChange: (newStatus: string) => void
}

export default function SearchWithFilterInput({
  searchValue,
  status,
  onChange,
  onStatusChange,
}: SearchWithFilterInputProps) {
  const filterRef = useRef<HTMLDivElement>(null)
  const [inputPadding, setInputPadding] = useState<number>(0)
  const [tempSearchValue, setTempSearchValue] = useState(searchValue)

  const handleSearchInputChangeDebounced = useMemo(
    () => debounce(onChange, 500),
    [onChange],
  )

  const onSearchInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setTempSearchValue(event.target.value)
      handleSearchInputChangeDebounced(event.target.value)
    },
    [handleSearchInputChangeDebounced],
  )

  const clearSearch = useCallback(() => {
    setTempSearchValue('')
    onChange('')
    handleSearchInputChangeDebounced.cancel()
  }, [onChange, handleSearchInputChangeDebounced])

  // update padding of input element when filter element width changes.
  useEffect(() => {
    if (!filterRef.current) {
      return
    }
    setInputPadding(filterRef.current.offsetWidth + 8)
  }, [status])

  return (
    <InputGroup>
      <InputLeftElement>
        <Icon as={BiSearch} boxSize={5} />
      </InputLeftElement>
      <Input
        textStyle="body-1"
        w={{ base: '100%', md: '25rem' }}
        maxW="100%"
        pr={inputPadding}
        placeholder="Search by pipe name"
        defaultValue={searchValue}
        value={tempSearchValue}
        onChange={onSearchInputChange}
      />
      <InputRightElement w="fit-content" p={1} ref={filterRef}>
        <Icon
          as={BiSolidXCircle}
          cursor="pointer"
          opacity={0.6}
          _hover={{ opacity: 1 }}
          h={4}
          w={4}
          mr={2}
          display={tempSearchValue ? 'block' : 'none'}
          onClick={clearSearch}
        />
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
      </InputRightElement>
    </InputGroup>
  )
}
