import { useState } from 'react'
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

export default function ExecutionStatusMenu() {
  const [filterValue, setFilterValue] = useState<string>('Status')

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
            {filterValue}
          </Text>
        </Flex>
      </MenuButton>
      <MenuList minW="180px">
        <MenuOptionGroup
          defaultValue="Status"
          type="radio"
          onChange={(val) => setFilterValue(val as string)}
        >
          <MenuItemOption value="Status">
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
