import { ITableCollaborator, ITableCollabRole } from '@plumber/types'

import { FormEventHandler, useContext, useState } from 'react'
import { BiChevronDown, BiTrash } from 'react-icons/bi'
import {
  Divider,
  Flex,
  FormControl,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  VStack,
} from '@chakra-ui/react'
import {
  Button,
  ButtonProps,
  IconButton,
  Input,
  Menu,
} from '@opengovsg/design-system-react'
import { AuthenticationContext } from 'contexts/Authentication'
import { useTableContext } from 'pages/Tile/contexts/TableContext'

const TableCollabRoleSelect = ({
  value,
  onChange,
  isEditable,
  variant = 'outline',
}: {
  value: ITableCollabRole
  onChange: (val: ITableCollabRole) => void
  isEditable: boolean
  variant?: ButtonProps['variant']
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
        <MenuItem onClick={() => onChange('editor')}>Editor</MenuItem>
        <MenuItem onClick={() => onChange('viewer')}>Viewer</MenuItem>
      </MenuList>
    </Menu>
  )
}

const AddNewCollaborator = () => {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ITableCollabRole>('editor')
  const [isAdding, setIsAdding] = useState(false)

  const onAdd: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault()
    setIsAdding(true)
    console.log('Adding collaborator', email, role)
    setIsAdding(false)
    setEmail('')
    setRole('editor')
  }

  return (
    <form
      style={{
        width: '100%',
      }}
      onSubmit={onAdd}
    >
      <FormControl>
        <VStack spacing={2} alignItems="flex-start">
          <Text textStyle="subhead-3">Collaborators</Text>
          <Flex alignSelf="stretch" gap={2}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TableCollabRoleSelect
              value={role}
              onChange={setRole}
              isEditable={true}
            />
          </Flex>
          <Button variant="outline" type="submit" isLoading={isAdding}>
            Add collaborator
          </Button>
        </VStack>
      </FormControl>
    </form>
  )
}

const CollaboratorListRow = ({
  collaborator,
  onRoleChange,
  onDelete,
}: {
  collaborator: ITableCollaborator
  onRoleChange: (role: ITableCollabRole) => void
  onDelete: () => void
}) => {
  const { currentUser } = useContext(AuthenticationContext)
  const isEditable =
    collaborator.role !== 'owner' && collaborator.email !== currentUser?.email

  return (
    <Flex alignItems="center" w="100%" py={1} px={4}>
      <Text flex={1}>{collaborator.email}</Text>
      <Flex w={44}>
        <TableCollabRoleSelect
          value={collaborator.role}
          onChange={onRoleChange}
          variant="clear"
          isEditable={isEditable}
        />
        {isEditable && (
          <IconButton
            colorScheme="critical"
            onClick={onDelete}
            aria-label={'remove collaborator'}
            variant="clear"
            icon={<BiTrash />}
          />
        )}
      </Flex>
    </Flex>
  )
}

const TableCollaborators = () => {
  const { collaborators } = useTableContext()

  if (!collaborators) {
    return null
  }
  return (
    <VStack gap={2}>
      <AddNewCollaborator />
      <VStack w="100%" divider={<Divider />}>
        {collaborators.map((collab) => (
          <CollaboratorListRow
            key={collab.email}
            collaborator={collab}
            onRoleChange={() => null}
            onDelete={() => null}
          />
        ))}
      </VStack>
    </VStack>
  )
}

export default TableCollaborators
