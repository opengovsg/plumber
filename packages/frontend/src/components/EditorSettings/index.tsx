import { IFlow } from '@plumber/types'

import { ElementType, ReactNode, useContext, useMemo, useState } from 'react'
import { BiLink, BiMailSend, BiTransfer, BiUserPlus } from 'react-icons/bi'
import { useParams } from 'react-router-dom'
import { ApolloError, useQuery } from '@apollo/client'
import { Box, Center, Divider, Flex, Show } from '@chakra-ui/react'

import PrimarySpinner from '@/components/PrimarySpinner'
import RedirectToLogin from '@/components/RedirectToLogin'
import * as URLS from '@/config/urls'
import { EditorSettingsProvider } from '@/contexts/EditorSettings'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'
import { GET_FLOW_WITH_COLLABORATORS } from '@/graphql/queries/get-flow'
import useAuthentication from '@/hooks/useAuthentication'
import InvalidEditorPage from '@/pages/Editor/components/InvalidEditorPage'

import EditorDrawer from './EditorDrawer'
import EditorSidebar from './EditorSidebar'
import Navbar from './Navbar'

const NAVBAR_HEIGHT = '65px'
const CONTENT_MAX_HEIGHT = `calc(100vh - ${NAVBAR_HEIGHT})`

export type DrawerLink = {
  Icon: ElementType
  text: string
  to: string
}

export type GroupedDrawerLinks = {
  group: string
  links: DrawerLink[]
}

export interface EditorSettingsLayoutProps {
  children: ReactNode
}

export default function EditorSettingsLayout(
  props: EditorSettingsLayoutProps,
): React.ReactElement {
  const { children } = props

  const { currentUser } = useAuthentication()

  // TODO: remove this once we open collaborators to all users
  const { getFlagValue } = useContext(LaunchDarklyContext)
  const showCollaborators = getFlagValue('collaborators', false)

  const { flowId } = useParams()
  const { data, loading, error } = useQuery(GET_FLOW_WITH_COLLABORATORS, {
    variables: { id: flowId },
  })
  const flow: IFlow = data?.getFlow

  const [isDrawerOpen, setDrawerOpen] = useState(false)

  const [drawerLinks, openDrawer, closeDrawer] = useMemo(
    () => [
      [
        {
          group: 'Manage',
          links: [
            showCollaborators && {
              Icon: BiUserPlus,
              text: 'Collaborators',
              to: URLS.FLOW_EDITOR_SHARE(flowId),
              group: 'Manage' as const,
            },
            {
              Icon: BiTransfer,
              text: 'Transfer Pipe',
              to: URLS.FLOW_EDITOR_TRANSFERS(flowId),
              group: 'Manage' as const,
            },
            flow?.role !== 'viewer' && {
              Icon: BiLink,
              text: 'Connections',
              to: URLS.FLOW_EDITOR_CONNECTIONS(flowId),
              group: 'Manage' as const,
            },
            {
              Icon: BiMailSend,
              text: 'Notifications',
              to: URLS.FLOW_EDITOR_NOTIFICATIONS(flowId),
              group: 'Manage' as const,
            },
          ].filter(Boolean),
        },
      ].filter(Boolean),
      () => setDrawerOpen(true),
      () => setDrawerOpen(false),
    ],
    [flowId, setDrawerOpen, showCollaborators, flow?.role],
  )

  const mobileDrawerComponent = (
    <>
      <EditorDrawer
        groupedLinks={drawerLinks}
        isDrawerOpen={isDrawerOpen}
        openDrawer={openDrawer}
        closeDrawer={closeDrawer}
      />
      <Divider borderColor="base.divider.medium" />
    </>
  )

  const desktopSidebarComponent = (
    <EditorSidebar groupedLinks={drawerLinks} closeDrawer={closeDrawer} />
  )

  if (!currentUser) {
    return <RedirectToLogin />
  }

  // TODO: React suspense should fix all the loading
  // ensures that the flow will be correctly passed over to the sub pages e.g. notifications, transfer
  if (loading) {
    return (
      <Center h="100vh">
        <PrimarySpinner fontSize="6xl" />
      </Center>
    )
  }

  // navigate user to invalid page if flow does not belong to the user
  if (
    error instanceof ApolloError &&
    error?.graphQLErrors?.find((e) => e.message === 'NotFoundError')
  ) {
    return <InvalidEditorPage />
  }

  return (
    <EditorSettingsProvider flow={flow}>
      <Flex flexDir="column" h="100vh">
        <Navbar />
        <Flex
          w="full"
          flex={1}
          flexDir={{ base: 'column', md: 'row' }}
          mt={NAVBAR_HEIGHT}
          minH="0"
        >
          {/* Mobile: drawer (no sticky) */}
          <Show below="md">{mobileDrawerComponent}</Show>

          {/* Desktop: sticky sidebar */}
          <Show above="md">
            <Box
              position="sticky"
              top={NAVBAR_HEIGHT}
              height={CONTENT_MAX_HEIGHT}
              overflowY="auto"
            >
              {desktopSidebarComponent}
            </Box>
            <Divider
              orientation="vertical"
              borderColor="base.divider.medium"
              height="auto"
            />
          </Show>

          {/* Content area with independent scroll */}
          <Box flex={1} overflowY="auto" minH="0">
            {children}
          </Box>
        </Flex>
      </Flex>
    </EditorSettingsProvider>
  )
}
