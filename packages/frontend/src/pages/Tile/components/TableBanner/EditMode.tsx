import { Flex, MenuButton, MenuItem, MenuList, Text } from '@chakra-ui/react'
import { Badge, Menu } from '@opengovsg/design-system-react'
import { useMemo } from 'react'
import { BiChevronDown } from 'react-icons/bi'
import { MdOutlineModeEdit, MdOutlineRemoveRedEye } from 'react-icons/md'

import { useTableContext } from '../../contexts/TableContext'
import { type EditMode } from '../../types'

interface ModeOption {
  label: string
  icon: React.ReactElement
  colorScheme: string
  value: EditMode
}

const MODES: ModeOption[] = [
  {
    label: 'Edit Mode',
    icon: <MdOutlineModeEdit size={16} />,
    colorScheme: 'primary',
    value: 'edit',
  },
  {
    label: 'View only',
    icon: <MdOutlineRemoveRedEye size={16} />,
    colorScheme: 'secondary',
    value: 'view',
  },
]

const EditMode = () => {
  const { mode, setMode, hasEditPermission } = useTableContext()

  const selectedModeOption = useMemo(
    () => MODES.find((m) => m.value === mode) ?? MODES[0],
    [mode],
  )

  return (
    <Menu gutter={0} colorScheme="secondary">
      <Badge
        as={MenuButton}
        variant="subtle"
        size="xs"
        fontSize="xs"
        height={{ base: 10, md: 7 }}
        my="auto"
        border="none"
        colorScheme={selectedModeOption.colorScheme}
        pointerEvents={hasEditPermission ? 'auto' : 'none'}
      >
        <Flex alignItems="center" gap={2}>
          {selectedModeOption.icon}
          <Text display={{ base: 'none', md: 'flex' }}>
            {selectedModeOption.label}
          </Text>
          {hasEditPermission && <BiChevronDown />}
        </Flex>
      </Badge>

      <MenuList borderRadius="md">
        {MODES.map(({ label, icon, value, colorScheme }) => (
          <MenuItem
            fontSize="sm"
            icon={icon}
            key={value}
            color={`${colorScheme}.600`}
            isDisabled={!hasEditPermission && value === 'edit'}
            onClick={() => setMode(value)}
          >
            {label}
          </MenuItem>
        ))}
      </MenuList>
    </Menu>
  )
}

export default EditMode
