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
import { TEST_ITEM_LIST } from './TestItemList'

const LOCAL_STORAGE_LAST_READ_KEY = 'news-drawer-last-read'

// this fetches the latest time from the news
const latestNewsTimestamp =
  TEST_ITEM_LIST.length > 0
    ? new Date(TEST_ITEM_LIST[0].date).getTime().toString()
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
  }, [latestNewsTimestamp])

  const { isOpen, onOpen, onClose } = useDisclosure({ onOpen: handleOpen })

  if (TEST_ITEM_LIST.length === 0) {
    return null
  }

  return (
    <>
      <Button
        color="secondary.500"
        size="xs"
        variant="link"
        mr={4}
        onClick={onOpen}
      >
        <Text fontWeight="normal">What's new</Text>
      </Button>
      {localLatestTimestamp !== latestNewsTimestamp && (
        <Box
          borderRadius="50%"
          bg="#C05050"
          w={1.5}
          h={1.5}
          ml={-5}
          mb={3}
          mr={2}
        />
      )}
      <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="lg">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader textStyle="h2" fontSize="2xl" color="secondary.700">
            What's New
          </DrawerHeader>

          <DrawerBody>
            <Stack
              divider={<StackDivider borderColor="gray.300"></StackDivider>}
              spacing="1rem"
            >
              {TEST_ITEM_LIST.map((item, index) => (
                <NewsItem key={index} {...item} />
              ))}
            </Stack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  )
}
