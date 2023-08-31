import { BiFilter } from 'react-icons/bi'
import {
  Button,
  Flex,
  Icon,
  Menu,
  MenuButton,
  MenuItemOption,
  MenuList,
  MenuOptionGroup,
  Text,
} from '@chakra-ui/react'

interface ExecutionStatusMenuProps {
  filterStatus: string
  onFilterChange: (status: string) => void
}

export default function ExecutionStatusMenu(props: ExecutionStatusMenuProps) {
  const { filterStatus, onFilterChange } = props

  return (
    <Menu closeOnSelect={false}>
      <MenuButton
        bg="interaction.tinted.main.active"
        as={Button}
        variant="clear"
      >
        <Flex alignItems="center">
          <Icon boxSize={5} as={BiFilter} color="primary.600" mr={2} />
          <Text textStyle="subhead-2" color="primary.600">
            {filterStatus || 'Status'}
          </Text>
        </Flex>
      </MenuButton>
      <MenuList minW="180px">
        <MenuOptionGroup
          defaultValue=""
          type="radio"
          onChange={(val) => onFilterChange(val as string)}
        >
          <MenuItemOption value="">
            <Text textStyle="body-1">All Executions</Text>
          </MenuItemOption>
          <MenuItemOption value="Success">
            <Text textStyle="body-1">Success</Text>
          </MenuItemOption>
          <MenuItemOption value="Failure">
            <Text textStyle="body-1">Failure</Text>
          </MenuItemOption>
        </MenuOptionGroup>
      </MenuList>
    </Menu>
  )
}
