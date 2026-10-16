import { Menu, MenuButton, MenuItem, MenuList } from '@chakra-ui/react'
import { Button, ButtonProps } from '@opengovsg/design-system-react'
import { IFlowCollabRole, ITableCollabRole } from '@plumber/types'
import { BiChevronDown } from 'react-icons/bi'

const CollaboratorRoleSelect = ({
  userRole,
  value,
  onChange,
  isEditable,
  variant = 'outline',
  showOwnerOption = true,
}: {
  userRole: IFlowCollabRole | ITableCollabRole
  value: IFlowCollabRole | ITableCollabRole
  onChange: (val: IFlowCollabRole | ITableCollabRole) => void
  isEditable: boolean
  variant?: ButtonProps['variant']
  showOwnerOption?: boolean
}) => {
  return (
    <Menu gutter={0}>
      <MenuButton
        as={Button}
        pointerEvents={isEditable ? 'auto' : 'none'}
        colorScheme="secondary"
        variant={variant}
        w={32}
        px={6}
        textTransform="capitalize"
        rightIcon={isEditable ? <BiChevronDown /> : undefined}
        textAlign={variant === 'clear' ? 'left' : 'center'}
      >
        {value}
      </MenuButton>
      <MenuList w={32}>
        {userRole === 'owner' && showOwnerOption && (
          <MenuItem onClick={() => onChange('owner')}>Owner</MenuItem>
        )}
        <MenuItem onClick={() => onChange('editor')}>Editor</MenuItem>
        <MenuItem onClick={() => onChange('viewer')}>Viewer</MenuItem>
      </MenuList>
    </Menu>
  )
}

export default CollaboratorRoleSelect
