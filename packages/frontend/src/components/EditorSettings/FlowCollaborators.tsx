import { useMutation } from '@apollo/client'
import { Flex, Text } from '@chakra-ui/react'
import { Infobox, useToast } from '@opengovsg/design-system-react'
import { useCallback, useContext } from 'react'
import { Link } from 'react-router-dom'

import * as URLS from '@/config/urls'
import { EditorSettingsContext } from '@/contexts/EditorSettings'
import { UPSERT_FLOW_COLLABORATOR } from '@/graphql/mutations/upsert-flow-collaborator'
import { GET_FLOW_WITH_COLLABORATORS } from '@/graphql/queries/get-flow'

import CollaboratorsTable from './FlowCollaborators/CollaboratorsTable'
import AddNewCollaborator from './FlowShare/AddNewCollaborator'
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
      <Flex flexDir="column" gap={2}>
        <Text textStyle="h5">Collaborators</Text>
        {/* Connections appear if pipe is unpublished */}
        {flow.role !== 'viewer' && (
          <Infobox variant="info" borderRadius="md" w="100%">
            <Flex flexDir="column" gap={2}>
              <Text textStyle="body-1">
                Editors can use the{' '}
                <Link to={URLS.FLOW_EDITOR_CONNECTIONS(flow.id)}>
                  connections linked to this Pipe
                </Link>
                .
              </Text>
            </Flex>
          </Infobox>
        )}
      </Flex>
      <Flex flexDir="column" gap={4} w="100%">
        {hasEditPermission && (
          <AddNewCollaborator flow={flow} onAdd={upsertCollaboratorHandler} />
        )}
        <CollaboratorsTable
          collaborators={collaborators}
          onRoleChange={(email, role) =>
            upsertCollaboratorHandler(email, role, true)
          }
        />
      </Flex>
    </Flex>
  )
}
