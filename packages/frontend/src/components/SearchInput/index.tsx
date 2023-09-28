import { BiSearch } from 'react-icons/bi'
import { Icon, InputGroup, InputRightElement } from '@chakra-ui/react'
import { Input } from '@opengovsg/design-system-react'

type SearchInputProps = {
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
}

export default function SearchInput({
  onChange,
}: SearchInputProps): React.ReactElement {
  return (
    <InputGroup>
      <Input
        type="text"
        w="full"
        size="lg"
        fontSize="md"
        onChange={onChange}
        placeholder="Search"
      />
      <InputRightElement
        h="100%"
        children={<Icon as={BiSearch} style={{ height: 20, width: 20 }} />}
      />
    </InputGroup>
  )
}
