import { ElementType, ReactNode, useMemo, useState } from 'react'
import { BiMailSend } from 'react-icons/bi'
import { Navigate, useParams } from 'react-router-dom'
import {
  Box,
  Divider,
  Flex,
  useBreakpointValue,
  VStack,
} from '@chakra-ui/react'
import * as URLS from 'config/urls'
import useAuthentication from 'hooks/useAuthentication'

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
  const [isDrawerOpen, setDrawerOpen] = useState(false)

  const openDrawer = () => setDrawerOpen(true)
  const closeDrawer = () => setDrawerOpen(false)

  const drawerLinks = useMemo(
    () => [
      {
        Icon: BiMailSend,
        text: 'Email notifications',
        to: URLS.FLOW_EDITOR_NOTIFICATIONS(flowId),
      },
    ],
    [flowId],
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
        <Box mt={4}>
          <EditorSidebar links={drawerLinks} closeDrawer={closeDrawer} />
        </Box>
        <Divider orientation="vertical" borderColor="base.divider.medium" />
      </>
    ),
  })

  if (!currentUser) {
    const redirectQueryParam = window.location.pathname + window.location.search
    return (
      <Navigate
        to={URLS.ADD_REDIRECT_TO_LOGIN(encodeURIComponent(redirectQueryParam))}
      />
    )
  }

  return (
    <>
      <VStack h="100%" spacing={0}>
        <Navbar />
        <Flex w="full" h="100vh" flexDir={{ base: 'column', md: 'row' }}>
          {drawerComponent}
          {children}
        </Flex>
      </VStack>
    </>
  )
}
