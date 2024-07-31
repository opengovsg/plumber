import { IFlow } from '@plumber/types'

import { ElementType, ReactNode, useMemo, useState } from 'react'
import { BiMailSend, BiTransfer } from 'react-icons/bi'
import { useParams } from 'react-router-dom'
import { ApolloError, useQuery } from '@apollo/client'
import {
  Center,
  Divider,
  Flex,
  useBreakpointValue,
  VStack,
} from '@chakra-ui/react'

import PrimarySpinner from '@/components/PrimarySpinner'
import RedirectToLogin from '@/components/RedirectToLogin'
import * as URLS from '@/config/urls'
import { EditorSettingsProvider } from '@/contexts/EditorSettings'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import useAuthentication from '@/hooks/useAuthentication'
import InvalidEditorPage from '@/pages/Editor/components/InvalidEditorPage'

import EditorDrawer from './EditorDrawer'
import EditorSidebar from './EditorSidebar'
import Navbar from './Navbar'

export type DrawerLink = {
  Icon: ElementType
  text: string
  to: string
}

export interface EditorSettingsLayoutProps {
  children: ReactNode
}

export default function EditorSettingsLayout(
  props: EditorSettingsLayoutProps,
): React.ReactElement {
  const { children } = props

  const { currentUser } = useAuthentication()

  const { flowId } = useParams()
  const { data, loading, error } = useQuery(GET_FLOW, {
    variables: { id: flowId },
  })
  const flow: IFlow = data?.getFlow

  const [isDrawerOpen, setDrawerOpen] = useState(false)

  const [drawerLinks, openDrawer, closeDrawer] = useMemo(
    () => [
      [
        {
          Icon: BiMailSend,
          text: 'Email notifications',
          to: URLS.FLOW_EDITOR_NOTIFICATIONS(flowId),
        },
        {
          Icon: BiTransfer,
          text: 'Transfer Pipe',
          to: URLS.FLOW_EDITOR_TRANSFERS(flowId),
        },
      ],
      () => setDrawerOpen(true),
      () => setDrawerOpen(false),
    ],
    [flowId, setDrawerOpen],
  )

  const drawerComponent = useBreakpointValue({
    base: (
      <>
        <EditorDrawer
          links={drawerLinks}
          isDrawerOpen={isDrawerOpen}
          openDrawer={openDrawer}
          closeDrawer={closeDrawer}
        />
        <Divider borderColor="base.divider.medium" />
      </>
    ),
    md: (
      <>
        <EditorSidebar links={drawerLinks} closeDrawer={closeDrawer} />
        <Divider
          orientation="vertical"
          borderColor="base.divider.medium"
          height="auto"
        />
      </>
    ),
  })

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
    <EditorSettingsProvider value={{ flow }}>
      <VStack spacing={0} minH="100vh">
        <Navbar />
        <Flex w="full" flex={1} flexDir={{ base: 'column', md: 'row' }}>
          {drawerComponent}
          {children}
        </Flex>
      </VStack>
    </EditorSettingsProvider>
  )
}
