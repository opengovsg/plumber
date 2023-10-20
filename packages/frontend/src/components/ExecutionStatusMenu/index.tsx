import { memo, useMemo } from 'react'
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

export enum StatusType {
  Empty = '',
  Success = 'success',
  Failure = 'failure',
  Waiting = 'waiting',
}

const filterOptions = [
  {
    displayLabel: 'Status',
    inputLabel: 'All Executions',
    value: StatusType.Empty,
  },
  {
    displayLabel: 'Success',
    inputLabel: 'Success',
    value: StatusType.Success,
  },
  {
    displayLabel: 'Failure',
    inputLabel: 'Failure',
    value: StatusType.Failure,
  },
  {
    displayLabel: 'Waiting',
    inputLabel: 'Waiting',
    value: StatusType.Waiting,
  },
]

interface ExecutionStatusMenuProps {
  filterStatus: string
  onFilterChange: (status: string) => void
}

function ExecutionStatusMenu(props: ExecutionStatusMenuProps) {
  const { filterStatus, onFilterChange } = props

  const filterLabel = useMemo(
    () =>
      filterOptions.find((option) => option.value === filterStatus)
        ?.displayLabel,
    [filterStatus],
  )

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
            {filterLabel}
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

export default memo(ExecutionStatusMenu)
