import { ITableCollaborator, ITableCollabRole } from '@plumber/types'

import { FormEventHandler, useCallback, useContext, useState } from 'react'
import { BiChevronDown, BiTrash } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
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
  Tag,
  useToast,
} from '@opengovsg/design-system-react'

import { AuthenticationContext } from '@/contexts/Authentication'
import { DELETE_TABLE_COLLABORATOR } from '@/graphql/mutations/tiles/delete-table-collaborator'
import { UPSERT_TABLE_COLLABORATOR } from '@/graphql/mutations/tiles/upsert-table-collaborator'
import { GET_TABLE } from '@/graphql/queries/tiles/get-table'
import { useTableContext } from '@/pages/Tile/contexts/TableContext'

import { useShareModalContext } from './ShareModalContext'

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
  const { role } = useTableContext()

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
        {role === 'owner' && (
          <MenuItem onClick={() => onChange('owner')}>Owner</MenuItem>
        )}
        <MenuItem onClick={() => onChange('editor')}>Editor</MenuItem>
        <MenuItem onClick={() => onChange('viewer')}>Viewer</MenuItem>
      </MenuList>
    </Menu>
  )
}

const AddNewCollaborator = ({
  onAdd,
}: {
  onAdd: (email: string, role: string) => Promise<void>
}) => {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ITableCollabRole>('editor')
  const [isAdding, setIsAdding] = useState(false)

  const onSubmit: FormEventHandler<HTMLFormElement> = useCallback(
    async (e) => {
      try {
        e.preventDefault()
        setIsAdding(true)
        await onAdd(email, role)
        setEmail('')
      } finally {
        setIsAdding(false)
      }
    },
    [email, onAdd, role],
  )

  return (
    <form
      style={{
        width: '100%',
      }}
      onSubmit={onSubmit}
    >
      <FormControl>
        <VStack spacing={2} alignItems="flex-start">
          <Flex alignSelf="stretch" gap={2}>
            <Input
              type="email"
              value={email}
              isRequired
              onChange={(e) => setEmail(e.target.value)}
            />
            <TableCollabRoleSelect
              value={role}
              onChange={setRole}
              isEditable={true}
            />
          </Flex>
          <Button
            variant={role === 'owner' ? 'solid' : 'outline'}
            colorScheme="red"
            type="submit"
            isLoading={isAdding}
          >
            {role === 'owner' ? 'Transfer ownership' : 'Add collaborator'}
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
  const { hasEditPermission } = useTableContext()

  const [isDeleting, setIsDeleting] = useState(false)
  const isOwner = collaborator.role === 'owner'
  const isSelf = collaborator.email === currentUser?.email
  const isEditable = hasEditPermission && !isOwner && !isSelf

  const onDeleteHandler = useCallback(async () => {
    setIsDeleting(true)
    try {
      await onDelete()
    } finally {
      setIsDeleting(false)
    }
  }, [onDelete])

  return (
    <Flex alignItems="center" w="100%" py={1} px={4}>
      <Text flex={1}>
        {collaborator.email}{' '}
        {isSelf && (
          <Tag colorScheme="secondary" size="sm" ml={2} pointerEvents="none">
            You
          </Tag>
        )}
      </Text>
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
            onClick={onDeleteHandler}
            aria-label={'remove collaborator'}
            variant="clear"
            isLoading={isDeleting}
            icon={<BiTrash />}
          />
        )}
      </Flex>
    </Flex>
  )
}

const TableCollaborators = () => {
  const { collaborators, tableId, hasEditPermission } = useTableContext()
  const { setEmailToTransfer } = useShareModalContext()
  const toast = useToast({
    status: 'success',
    duration: 3000,
    isClosable: true,
  })
  const [upsertCollaborator] = useMutation(UPSERT_TABLE_COLLABORATOR)
  const [deleteCollaborator] = useMutation(DELETE_TABLE_COLLABORATOR)

  const deleteCollaboratorHandler = useCallback(
    async (email: string) => {
      await deleteCollaborator({
        variables: {
          input: {
            tableId,
            email,
          },
        },
        refetchQueries: [GET_TABLE],
        awaitRefetchQueries: false,
        onCompleted: () =>
          toast({
            title: 'Collaborator deleted',
            description: `Access for ${email} has been removed`,
          }),
      })
    },
    [deleteCollaborator, tableId, toast],
  )

  const upsertCollaboratorHandler = useCallback(
    async (email: string, role: string, update?: boolean) => {
      if (role === 'owner') {
        setEmailToTransfer(email)
        return
      }
      await upsertCollaborator({
        variables: {
          input: {
            tableId,
            email,
            role,
          },
        },
        refetchQueries: [GET_TABLE],
        awaitRefetchQueries: false,
        onCompleted: () =>
          toast({
            title: `Collaborator ${update ? 'updated' : 'added'}`,
            description: (
              <Text>
                {email} {update ? `role updated to` : 'added as'} <b>{role}</b>
              </Text>
            ),
          }),
      })
    },
    [setEmailToTransfer, tableId, toast, upsertCollaborator],
  )

  if (!collaborators) {
    return null
  }

  return (
    <VStack gap={2} alignItems="flex-start">
      <Text textStyle="subhead-3">Collaborators</Text>
      {hasEditPermission && (
        <AddNewCollaborator onAdd={upsertCollaboratorHandler} />
      )}
      <VStack w="100%" divider={<Divider />}>
        {collaborators.map((collab) => (
          <CollaboratorListRow
            key={collab.email}
            collaborator={collab}
            onRoleChange={(newRole) =>
              upsertCollaboratorHandler(collab.email, newRole, true)
            }
            onDelete={() => deleteCollaboratorHandler(collab.email)}
          />
        ))}
      </VStack>
    </VStack>
  )
}

export default TableCollaborators
