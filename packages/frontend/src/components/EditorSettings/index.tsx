import { ElementType, ReactNode, useMemo, useState } from 'react'
import { BiMailSend } from 'react-icons/bi'
import { useParams } from 'react-router-dom'
import {
  Box,
  Divider,
  Flex,
  useBreakpointValue,
  VStack,
} from '@chakra-ui/react'
import RedirectToLogin from 'components/RedirectToLogin'
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

  const [drawerLinks, openDrawer, closeDrawer] = useMemo(
    () => [
      [
        {
          Icon: BiMailSend,
          text: 'Email notifications',
          to: URLS.FLOW_EDITOR_NOTIFICATIONS(flowId),
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
        <Box mt={4}>
          <EditorSidebar links={drawerLinks} closeDrawer={closeDrawer} />
        </Box>
        <Divider orientation="vertical" borderColor="base.divider.medium" />
      </>
    ),
  })

  if (!currentUser) {
    return <RedirectToLogin />
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
