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
    <Menu placement="bottom-end">
      <MenuButton
        bg="white"
        as={Button}
        variant="clear"
        _hover={{ bg: 'interaction.tinted.main.hover' }}
        _active={{ bg: 'interaction.tinted.main.active' }}
      >
        <Flex alignItems="center">
          <Icon boxSize={5} as={BiFilter} color="primary.600" mr={2} />
          <Text textStyle="subhead-2" color="primary.600">
            {filterStatus || 'Status'}
          </Text>
        </Flex>
      </MenuButton>
      <MenuList mt={0} minW="10.625rem" borderRadius={1}>
        <MenuOptionGroup
          defaultValue={filterStatus}
          type="radio"
          onChange={(val) => onFilterChange(val as string)}
        >
          <MenuItemOption value="">
            <Text textStyle="body-1" color="base.content.strong">
              All Executions
            </Text>
          </MenuItemOption>
          <MenuItemOption value="Success">
            <Text textStyle="body-1" color="base.content.strong">
              Success
            </Text>
          </MenuItemOption>
          <MenuItemOption value="Failure">
            <Text textStyle="body-1" color="base.content.strong">
              Failure
            </Text>
          </MenuItemOption>
        </MenuOptionGroup>
      </MenuList>
    </Menu>
  )
}
