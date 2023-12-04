import { BiSearch } from 'react-icons/bi'
import { Icon, InputGroup, InputRightElement } from '@chakra-ui/react'
import { Input } from '@opengovsg/design-system-react'

type SearchInputProps = {
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
  searchValue?: string
}

export default function SearchInput({
  onChange,
  searchValue,
}: SearchInputProps): React.ReactElement {
  return (
    <InputGroup>
      <Input
        type="text"
        w="full"
        size="lg"
        fontSize="md"
        onChange={onChange}
        defaultValue={searchValue}
        placeholder="Search"
        autoFocus
      />
      <InputRightElement h="100%">
        <Icon as={BiSearch} style={{ height: 20, width: 20 }} />
      </InputRightElement>
    </InputGroup>
  )
}
