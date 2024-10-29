import { useCallback, useMemo, useState } from 'react'
import { BiSearch, BiSolidXCircle } from 'react-icons/bi'
import {
  Icon,
  InputGroup,
  InputLeftElement,
  InputRightElement,
} from '@chakra-ui/react'
import { Input } from '@opengovsg/design-system-react'
import debounce from 'lodash/debounce'

type DebouncedSearchInputProps = {
  onChange: (val: string) => void
  searchValue: string
}

export default function DebouncedSearchInput({
  onChange,
  searchValue,
}: DebouncedSearchInputProps): React.ReactElement {
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

  return (
    <InputGroup>
      <InputLeftElement h="100%">
        <Icon as={BiSearch} h={5} w={5} />
      </InputLeftElement>
      <Input
        type="text"
        minW="20rem"
        maxW="100%"
        fontSize="md"
        onChange={onSearchInputChange}
        value={tempSearchValue}
        placeholder="Search"
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
