import { useMemo } from 'react'
import { MdOutlineModeEdit, MdOutlineRemoveRedEye } from 'react-icons/md'
import { Flex, MenuButton, MenuItem, MenuList, Text } from '@chakra-ui/react'
import { Badge, Menu } from '@opengovsg/design-system-react'

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
    label: 'View only',
    icon: <MdOutlineRemoveRedEye size={16} />,
    colorScheme: 'secondary',
    value: 'view',
  },
  {
    label: 'Edit Mode',
    icon: <MdOutlineModeEdit size={16} />,
    colorScheme: 'primary',
    value: 'edit',
  },
]

const EditMode = () => {
  const { mode, setMode, hasEditPermission } = useTableContext()

  const selectedModeOption = useMemo(
    () => MODES.find((m) => m.value === mode) ?? MODES[0],
    [mode],
  )

  if (mode === 'edit') {
    return null
  }

  return (
    <Menu gutter={0} colorScheme="secondary">
      <MenuButton
        as={Badge}
        /**
         * Prevent the button from being clicked, as it is only used to display the current mode
         * remove this prop to allow selection of view/edit mode
         */
        pointerEvents="none"
        variant="subtle"
        size="xs"
        fontSize="xs"
        py={1}
        border="none"
        colorScheme={selectedModeOption.colorScheme}
      >
        <Flex alignItems="center" gap={1}>
          {selectedModeOption.icon}
          <Text display={{ base: 'none', md: 'flex' }}>
            {selectedModeOption.label}
          </Text>
        </Flex>
      </MenuButton>

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
