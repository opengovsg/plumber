import {
  Icon,
  InputGroup,
  InputLeftElement,
  InputRightElement,
} from '@chakra-ui/react'
import { Input } from '@opengovsg/design-system-react'
import debounce from 'lodash/debounce'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BiSearch, BiSolidXCircle } from 'react-icons/bi'

type DebouncedSearchInputProps = {
  onChange: (val: string) => void
  searchValue: string
  placeholder?: string
  minW?: string | number
  /** Applies a pending debounced change on unmount so a remount stays in sync. */
  flushOnUnmount?: boolean
}

export default function DebouncedSearchInput({
  onChange,
  searchValue,
  placeholder = 'Search',
  minW = '20rem',
  flushOnUnmount = false,
}: DebouncedSearchInputProps): React.ReactElement {
  const [tempSearchValue, setTempSearchValue] = useState(searchValue)

  const handleSearchInputChangeDebounced = useMemo(
    () => debounce(onChange, 500),
    [onChange],
  )

  useEffect(
    () => () => {
      if (flushOnUnmount) {
        handleSearchInputChangeDebounced.flush()
      }
    },
    [flushOnUnmount, handleSearchInputChangeDebounced],
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

  return (
    <InputGroup>
      <InputLeftElement h="100%">
        <Icon as={BiSearch} h={5} w={5} />
      </InputLeftElement>
      <Input
        type="text"
        minW={minW}
        maxW="100%"
        fontSize="md"
        onChange={onSearchInputChange}
        value={tempSearchValue}
        placeholder={placeholder}
      />
      {tempSearchValue && (
        <InputRightElement h="100%">
          <Icon
            as={BiSolidXCircle}
            cursor="pointer"
            opacity={0.6}
            _hover={{ opacity: 1 }}
            onClick={clearSearch}
          />
        </InputRightElement>
      )}
    </InputGroup>
  )
}
