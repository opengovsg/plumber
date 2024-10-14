import { useCallback, useMemo } from 'react'
import { BiSearch } from 'react-icons/bi'
import { Icon, InputGroup, InputLeftElement } from '@chakra-ui/react'
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
  const handleSearchInputChangeDebounced = useMemo(
    () => debounce(onChange, 500),
    [onChange],
  )

  const onSearchInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      handleSearchInputChangeDebounced(event.target.value)
    },
    [handleSearchInputChangeDebounced],
  )

  return (
    <InputGroup>
      <InputLeftElement h="100%">
        <Icon as={BiSearch} style={{ height: 20, width: 20 }} />
      </InputLeftElement>
      <Input
        type="text"
        w="full"
        fontSize="md"
        onChange={onSearchInputChange}
        defaultValue={searchValue}
        placeholder="Search"
      />
    </InputGroup>
  )
}
