import { IFlowCollaborator, IFlowCollabRole } from '@plumber/types'

import { useCallback, useContext, useState } from 'react'
import { BiTrash } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { Flex, Text } from '@chakra-ui/react'
import { IconButton, Tag, useToast } from '@opengovsg/design-system-react'

import CollaboratorRoleSelect from '@/components/CollaboratorRoleSelect'
import { AuthenticationContext } from '@/contexts/Authentication'
import { EditorSettingsContext } from '@/contexts/EditorSettings'
import { DELETE_FLOW_COLLABORATOR } from '@/graphql/mutations/delete-flow-collaborator'
import { GET_FLOW_WITH_COLLABORATORS } from '@/graphql/queries/get-flow'

const CollaboratorListRow = ({
  collaborator,
  onRoleChange,
}: {
  collaborator: IFlowCollaborator
  onRoleChange: (role: IFlowCollabRole) => void
}) => {
  const { currentUser } = useContext(AuthenticationContext)
  const { flow, hasEditPermission } = useContext(EditorSettingsContext)
  const { email = '', role } = collaborator

  const toast = useToast({
    status: 'success',
    duration: 3000,
    isClosable: true,
  })

  const [deleteCollaborator] = useMutation(DELETE_FLOW_COLLABORATOR)

  const [isDeleting, setIsDeleting] = useState(false)
  const isOwner = role === 'owner'
  const isSelf = email === currentUser?.email
  const isEditable = hasEditPermission && !isOwner && !isSelf

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

  if (!flow.role) {
    return null
  }

  return (
    <Flex alignItems="center" w="100%" py={1}>
      <Text flex={1}>
        {collaborator.email}{' '}
        {isSelf && (
          <Tag colorScheme="secondary" size="sm" ml={2} pointerEvents="none">
            You
          </Tag>
        )}
      </Text>
      <Flex w={44}>
        <CollaboratorRoleSelect
          userRole={flow.role as IFlowCollabRole}
          value={collaborator.role}
          onChange={onRoleChange}
          variant="clear"
          isEditable={isEditable}
          // changing owner must be done via pipe transfer
          showOwnerOption={false}
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

export default CollaboratorListRow
