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
  Portal,
  Text,
} from '@chakra-ui/react'

const filterOptions = [
  {
    displayLabel: 'Status',
    inputLabel: 'All Executions',
    value: '',
  },
  {
    displayLabel: 'Success',
    inputLabel: 'Success',
    value: 'success',
  },
  {
    displayLabel: 'Failure',
    inputLabel: 'Failure',
    value: 'failure',
  },
  {
    displayLabel: 'Pending',
    inputLabel: 'Pending',
    value: 'pending',
  },
]

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
        size="xs"
        variant="clear"
        _hover={{ bg: 'interaction.tinted.main.hover' }}
        _active={{ bg: 'interaction.tinted.main.active' }}
      >
        <Flex alignItems="center">
          <Icon boxSize={5} as={BiFilter} color="primary.600" mr={2} />
          <Text textStyle="subhead-2" color="primary.600">
            {filterOptions.find((option) => option.value === filterStatus)
              ?.displayLabel || 'Status'}
          </Text>
        </Flex>
      </MenuButton>
      <Portal>
        <MenuList mt={0} w="10.625rem" borderRadius={1}>
          <MenuOptionGroup
            type="radio"
            onChange={(val) => onFilterChange(val as string)}
            value={filterStatus}
          >
            {filterOptions.map((option) => (
              <MenuItemOption key={option.value} value={option.value}>
                <Text textStyle="body-1" color="base.content.strong">
                  {option.inputLabel}
                </Text>
              </MenuItemOption>
            ))}
          </MenuOptionGroup>
        </MenuList>
      </Portal>
    </Menu>
  )
}
