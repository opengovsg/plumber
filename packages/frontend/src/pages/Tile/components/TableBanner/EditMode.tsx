import { useMemo } from 'react'
import { BiChevronDown } from 'react-icons/bi'
import { MdOutlineModeEdit, MdOutlineRemoveRedEye } from 'react-icons/md'
import { MenuButton, MenuItem, MenuList } from '@chakra-ui/react'
import { Button, Menu } from '@opengovsg/design-system-react'

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
  const { mode, setMode } = useTableContext()

  const selectedModeOption = useMemo(
    () => MODES.find((m) => m.value === mode) ?? MODES[0],
    [mode],
  )

  return (
    <Menu gutter={0} colorScheme="secondary">
      <MenuButton
        as={Button}
        variant="outline"
        size="xs"
        colorScheme={selectedModeOption.colorScheme}
        leftIcon={selectedModeOption.icon}
        rightIcon={<BiChevronDown />}
      >
        {selectedModeOption.label}
      </MenuButton>

      <MenuList borderRadius="md">
        {MODES.map(({ label, icon, value }) => (
          <MenuItem
            fontSize="sm"
            icon={icon}
            key={value}
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
