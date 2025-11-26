import { useCallback, useContext, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Stack,
  StackDivider,
  Text,
  useDisclosure,
} from '@chakra-ui/react'

import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'

import NewsItem from './NewsItem'
import { NEWS_ITEM_LIST } from './NewsItemList'

const LOCAL_STORAGE_LAST_READ_KEY = 'news-drawer-last-read'

export default function NewsDrawer({
  children,
}: {
  children: React.ReactNode
}) {
  // check whether user has read and closed the news drawer
  const [localLatestTimestamp, setLocalLatestTimestamp] = useState(
    localStorage.getItem(LOCAL_STORAGE_LAST_READ_KEY),
  )
  const { getFlagValue } = useContext(LaunchDarklyContext)

  const FILTERED_NEWS_ITEM_LIST = useMemo(() => {
    return NEWS_ITEM_LIST.filter((item) => {
      if (!item.ldFlagKey) {
        return true
      }
      // default to true since flag may get deleted in future
      return getFlagValue(item.ldFlagKey, true)
    })
  }, [getFlagValue])

  // this fetches the latest time from the news
  const latestNewsTimestamp =
    FILTERED_NEWS_ITEM_LIST.length > 0
      ? new Date(FILTERED_NEWS_ITEM_LIST[0].date).getTime().toString()
      : ''

  const handleOpen = useCallback(() => {
    // only way to update this is to change the news or clear the local storage
    localStorage.setItem(LOCAL_STORAGE_LAST_READ_KEY, latestNewsTimestamp)
    setLocalLatestTimestamp(latestNewsTimestamp)
  }, [latestNewsTimestamp])

  const { isOpen, onOpen, onClose } = useDisclosure({ onOpen: handleOpen })

  if (NEWS_ITEM_LIST.length === 0) {
    return null
  }

  return (
    <>
      <Button colorScheme="secondary" variant="link" onClick={onOpen}>
        {children}
        {localLatestTimestamp !== latestNewsTimestamp && (
          <Box
            borderRadius="50%"
            bg="primary.500"
            boxSize={1.5}
            top={0.5}
            right={-2}
            position="absolute"
          />
        )}
      </Button>

      <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="lg">
        <DrawerOverlay />
        <DrawerContent pl={2.5} pr={2.5}>
          <DrawerCloseButton mt={4} />
          <DrawerHeader fontSize="2xl" mt={8}>
            <Text textStyle="h4" color="base.content.default">
              {`What's new`}
            </Text>
          </DrawerHeader>

          <DrawerBody>
            <Stack
              divider={<StackDivider borderColor="gray.300"></StackDivider>}
              spacing="1rem"
            >
              {FILTERED_NEWS_ITEM_LIST.map((item, index) => (
                <NewsItem key={index} {...item} />
              ))}
            </Stack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  )
}
