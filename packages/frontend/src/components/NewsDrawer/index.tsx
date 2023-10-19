import { useCallback, useState } from 'react'
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

import NewsItem from './NewsItem'
import { NEWS_ITEM_LIST } from './NewsItemList'

const LOCAL_STORAGE_LAST_READ_KEY = 'news-drawer-last-read'

// this fetches the latest time from the news
const latestNewsTimestamp =
  NEWS_ITEM_LIST.length > 0
    ? new Date(NEWS_ITEM_LIST[0].date).getTime().toString()
    : ''

export default function NewsDrawer() {
  // check whether user has read and closed the news drawer
  const [localLatestTimestamp, setLocalLatestTimestamp] = useState(
    localStorage.getItem(LOCAL_STORAGE_LAST_READ_KEY),
  )

  const handleOpen = useCallback(() => {
    // only way to update this is to change the news or clear the local storage
    localStorage.setItem(LOCAL_STORAGE_LAST_READ_KEY, latestNewsTimestamp)
    setLocalLatestTimestamp(latestNewsTimestamp)
  }, [])

  const { isOpen, onOpen, onClose } = useDisclosure({ onOpen: handleOpen })

  if (NEWS_ITEM_LIST.length === 0) {
    return null
  }

  return (
    <>
      <Button colorScheme="secondary" variant="link" mr={6} onClick={onOpen}>
        <Text textStyle="subhead-1">{`What's new`}</Text>
        {localLatestTimestamp !== latestNewsTimestamp && (
          <Box
            borderRadius="50%"
            bg="primary.600"
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
          <DrawerCloseButton />
          <DrawerHeader fontSize="2xl">
            <Text textStyle="h4" color="base.content.default">
              {`What's new`}
            </Text>
          </DrawerHeader>

          <DrawerBody>
            <Stack
              divider={<StackDivider borderColor="gray.300"></StackDivider>}
              spacing="1rem"
            >
              {NEWS_ITEM_LIST.map((item, index) => (
                <NewsItem key={index} {...item} />
              ))}
            </Stack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  )
}
