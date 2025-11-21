import { useCallback, useContext } from 'react'
import { useMutation } from '@apollo/client'
import { Divider, Flex, Text, VStack } from '@chakra-ui/react'
import { useToast } from '@opengovsg/design-system-react'

import { EditorSettingsContext } from '@/contexts/EditorSettings'
import { UPSERT_FLOW_COLLABORATOR } from '@/graphql/mutations/upsert-flow-collaborator'
import { GET_FLOW_WITH_COLLABORATORS } from '@/graphql/queries/get-flow'

import AddNewCollaborator from './FlowShare/AddNewCollaborator'
import CollaboratorListRow from './FlowShare/CollaboratorListRow'
import { editorSettingsStyles as styles } from './styles'

export default function FlowCollaborators() {
  const { flow, hasEditPermission } = useContext(EditorSettingsContext)
  const [upsertCollaborator] = useMutation(UPSERT_FLOW_COLLABORATOR)

  const toast = useToast({
    status: 'success',
    duration: 3000,
    isClosable: true,
  })

  const collaborators = flow?.collaborators || []

  const upsertCollaboratorHandler = useCallback(
    async (email: string, role: string, update?: boolean) => {
      await upsertCollaborator({
        variables: { input: { flowId: flow.id, email, role } },
        refetchQueries: [GET_FLOW_WITH_COLLABORATORS],
        awaitRefetchQueries: false,
        onCompleted: () =>
          toast({
            title: `Collaborator ${update ? 'updated' : 'added'}`,
          }),
      })
    },
    [upsertCollaborator, flow.id, toast],
  )

  return (
    <Flex {...styles.editorSettingsWrapper}>
      <Text textStyle="h3-semibold">Share Pipe</Text>
      <VStack gap={2} alignItems="flex-start">
        {hasEditPermission && (
          <AddNewCollaborator flow={flow} onAdd={upsertCollaboratorHandler} />
        )}
        <VStack w="100%" divider={<Divider />}>
          {collaborators.map((collab) => (
            <CollaboratorListRow
              key={collab.email}
              collaborator={collab}
              onRoleChange={(newRole) =>
                upsertCollaboratorHandler(collab.email ?? '', newRole, true)
              }
            />
          ))}
        </VStack>
      </VStack>
    </Flex>
  )
}
