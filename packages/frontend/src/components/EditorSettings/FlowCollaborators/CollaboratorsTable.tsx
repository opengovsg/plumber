import { IFlow, IFlowCollaborator, IFlowCollabRole } from '@plumber/types'

import { useCallback, useContext, useRef, useState } from 'react'
import { BiLogOut, BiTrash } from 'react-icons/bi'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import {
  Center,
  Flex,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
} from '@chakra-ui/react'
import { IconButton, Tag, useToast } from '@opengovsg/design-system-react'

import CollaboratorRoleSelect from '@/components/CollaboratorRoleSelect'
import MenuAlertDialog from '@/components/MenuAlertDialog'
import PrimarySpinner from '@/components/PrimarySpinner'
import * as URLS from '@/config/urls'
import { AuthenticationContext } from '@/contexts/Authentication'
import { EditorSettingsContext } from '@/contexts/EditorSettings'
import { DELETE_FLOW_COLLABORATOR } from '@/graphql/mutations/delete-flow-collaborator'
import { GET_FLOW_WITH_COLLABORATORS } from '@/graphql/queries/get-flow'

interface TableRowProps {
  collaborator: IFlowCollaborator
  flow: IFlow
  hasEditPermission: boolean
  onRoleChange: (role: IFlowCollabRole) => void
}

const COLUMNS = ['Collaborator', 'Role', '']

const TableHeader = () => {
  return (
    <Thead>
      <Tr bg="interaction.neutral-subtle.default">
        {COLUMNS.map((column) => (
          <Th key={column} px={column === 'Role' ? 12 : undefined}>
            {column}
          </Th>
        ))}
      </Tr>
    </Thead>
  )
}

const TableRow = (props: TableRowProps) => {
  const { collaborator, flow, hasEditPermission, onRoleChange } = props
  const { currentUser } = useContext(AuthenticationContext)
  const { email = '', role } = collaborator
  const navigate = useNavigate()

  const toast = useToast({
    status: 'success',
    duration: 3000,
    isClosable: true,
  })

  const [deleteCollaborator] = useMutation(DELETE_FLOW_COLLABORATOR)
  const [isDeleting, setIsDeleting] = useState(false)

  const cancelRef = useRef<HTMLButtonElement>(null)
  const {
    isOpen: isLeaveDialogOpen,
    onOpen: onLeaveDialogOpen,
    onClose: onLeaveDialogClose,
  } = useDisclosure()

  const isOwner = role === 'owner'
  const isSelf = email === currentUser?.email
  const isEditable = hasEditPermission && !isOwner && !isSelf
  const canLeave = isSelf && !isOwner

  const onDeleteHandler = useCallback(async () => {
    setIsDeleting(true)
    try {
      await deleteCollaborator({
        variables: {
          input: { flowId: flow.id, email },
        },
        refetchQueries: [GET_FLOW_WITH_COLLABORATORS],
        awaitRefetchQueries: false,
        onCompleted: () =>
          toast({
            title: 'Collaborator deleted',
            description: `Access for ${email} has been removed`,
          }),
      })
    } finally {
      setIsDeleting(false)
    }
  }, [deleteCollaborator, email, flow.id, toast])

  const onLeaveHandler = useCallback(async () => {
    setIsDeleting(true)
    try {
      await deleteCollaborator({
        variables: {
          input: { flowId: flow.id, email },
        },
        onCompleted: () => {
          onLeaveDialogClose()
          toast({
            title: 'You have left this pipe',
          })
          navigate(URLS.FLOWS)
        },
      })
    } finally {
      setIsDeleting(false)
    }
  }, [deleteCollaborator, email, flow.id, navigate, onLeaveDialogClose, toast])

  return (
    <Tr key={email}>
      <Td>
        <Flex alignItems="center" gap={2}>
          <Text>{email}</Text>
          {isSelf && (
            <Tag colorScheme="secondary" size="sm" pointerEvents="none">
              You
            </Tag>
          )}
        </Flex>
      </Td>
      <Td>
        <CollaboratorRoleSelect
          userRole={flow.role as IFlowCollabRole}
          value={role}
          onChange={onRoleChange}
          variant="clear"
          isEditable={isEditable}
          showOwnerOption={false}
        />
      </Td>
      <Td>
        {isEditable && (
          <IconButton
            colorScheme="critical"
            onClick={onDeleteHandler}
            aria-label="remove collaborator"
            variant="clear"
            isLoading={isDeleting}
            icon={<BiTrash />}
          />
        )}
        {canLeave && (
          <>
            <IconButton
              colorScheme="critical"
              onClick={onLeaveDialogOpen}
              aria-label="leave pipe"
              variant="clear"
              isLoading={isDeleting}
              icon={<BiLogOut />}
            />
            <MenuAlertDialog
              cancelRef={cancelRef}
              isLoading={isDeleting}
              isDialogOpen={isLeaveDialogOpen}
              onDialogClose={onLeaveDialogClose}
              dialogType="leave"
              dialogHeader="Pipe"
              onClick={onLeaveHandler}
            />
          </>
        )}
      </Td>
    </Tr>
  )
}

interface CollaboratorsTableProps {
  collaborators: IFlowCollaborator[]
  loading?: boolean
  onRoleChange: (email: string, role: IFlowCollabRole) => void
}

export default function CollaboratorsTable({
  collaborators,
  loading,
  onRoleChange,
}: CollaboratorsTableProps) {
  const { flow, hasEditPermission } = useContext(EditorSettingsContext)

  if (loading) {
    return (
      <Center>
        <PrimarySpinner margin="auto" fontSize="4xl" />
      </Center>
    )
  }

  return (
    <TableContainer>
      <Table variant="simple" colorScheme="secondary">
        <TableHeader />
        <Tbody>
          {collaborators.map((collaborator) => (
            <TableRow
              key={collaborator.email}
              collaborator={collaborator}
              flow={flow}
              hasEditPermission={hasEditPermission}
              onRoleChange={(role) =>
                onRoleChange(collaborator.email ?? '', role)
              }
            />
          ))}
        </Tbody>
      </Table>
    </TableContainer>
  )
}
