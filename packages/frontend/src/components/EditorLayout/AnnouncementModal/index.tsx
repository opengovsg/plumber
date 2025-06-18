import { useState } from 'react'
import {
  Box,
  Flex,
  Modal,
  ModalContent,
  ModalFooter,
  ModalOverlay,
} from '@chakra-ui/react'
import {
  Button,
  ModalCloseButton,
  useIsMobile,
} from '@opengovsg/design-system-react'
import { AnimatePresence } from 'framer-motion'

import AnnouncementItem from './AnnouncementItem'
import { ANNOUNCEMENT_CONTENT_MAP } from './content'
import { MotionBox } from './MotionBox'
import { ProgressIndicator } from './ProgressIndicator'

export const LOCAL_STORAGE_ANNOUNCEMENT_LAST_OPENED_KEY =
  'announcement-modal-last-opened'

export const LATEST_ANNOUNCEMENT_MODAL_TIMESTAMP = '2025-05-28'

type AnnouncementItemKey = keyof typeof ANNOUNCEMENT_CONTENT_MAP

interface AnnouncementModalProps {
  isOpen: boolean
  onClose: () => void
  announcementContentKey?: string
}

const isValidAnnouncementItem = (
  value: string | undefined,
): value is AnnouncementItemKey =>
  value !== undefined && Object.keys(ANNOUNCEMENT_CONTENT_MAP).includes(value)

export default function AnnouncementModal(props: AnnouncementModalProps) {
  const { isOpen, onClose, announcementContentKey = 'ui-revamp-2025' } = props
  const [currActiveIdx, setCurrActiveIdx] = useState<number>(0)
  const isMobile = useIsMobile()

  if (!isValidAnnouncementItem(announcementContentKey)) {
    return null
  }

  const currAnnouncementConfig =
    ANNOUNCEMENT_CONTENT_MAP[announcementContentKey]
  const { announcementContent, buttonText } = currAnnouncementConfig
  const itemsLength = announcementContent.length

  const currAnnouncement = announcementContent[currActiveIdx]
  const isFirstAnnouncement = currActiveIdx === 0
  const isLastAnnouncement = currActiveIdx === itemsLength - 1

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      autoFocus={false}
      closeOnOverlayClick={false}
      closeOnEsc={false}
    >
      <ModalOverlay />
      <ModalContent
        borderRadius="lg"
        display="flex"
        flexDirection="column"
        h="630px"
      >
        <ModalCloseButton size="xs" zIndex={1} mr={-4} mt={-2} />

        <Box flexGrow={1} overflow={isMobile ? 'scroll' : 'none'}>
          <AnimatePresence mode="wait">
            <MotionBox
              key={currActiveIdx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              <AnnouncementItem {...currAnnouncement} />
            </MotionBox>
          </AnimatePresence>
        </Box>

        <ModalFooter>
          <Flex
            width="100vw"
            alignItems="center"
            justifyContent={itemsLength > 1 ? 'space-between' : 'flex-end'}
          >
            {itemsLength > 1 && (
              <ProgressIndicator
                numIndicators={itemsLength}
                currActiveIdx={currActiveIdx}
                onClick={setCurrActiveIdx}
              />
            )}
            <Flex gap={4}>
              {!isFirstAnnouncement && (
                <Button
                  onClick={() => setCurrActiveIdx(currActiveIdx - 1)}
                  variant="clear"
                  colorScheme="secondary"
                >
                  Back
                </Button>
              )}

              {isLastAnnouncement ? (
                <Button onClick={onClose}>{buttonText}</Button>
              ) : (
                <Button onClick={() => setCurrActiveIdx(currActiveIdx + 1)}>
                  Next
                </Button>
              )}
            </Flex>
          </Flex>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
