import { IAction, ITrigger } from '@plumber/types'

import { MdLightbulbOutline } from 'react-icons/md'
import { Flex, Icon, Link, useDisclosure } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'

import AnnouncementModal from '../EditorLayout/AnnouncementModal'

interface LearnMoreInfoboxProps {
  selectedActionOrTrigger: IAction | ITrigger | undefined
}

export default function LearnMoreInfobox(props: LearnMoreInfoboxProps) {
  const { selectedActionOrTrigger } = props
  const { announcementContentKey } = selectedActionOrTrigger || {}

  const {
    isOpen: isAnnouncementModalOpen,
    onOpen: onAnnouncementModalOpen,
    onClose: onAnnouncementModalClose,
  } = useDisclosure()

  if (!announcementContentKey) {
    return null
  }

  return (
    <>
      <Infobox
        icon={<Icon as={MdLightbulbOutline} color="primary.500" />}
        style={{
          borderRadius: '0.25rem',
          backgroundColor: '#FEF8FB',
          marginBottom: '1rem',
        }}
      >
        <Flex
          flexDir={{ base: 'column', md: 'row' }}
          gap={2}
          justifyContent="space-between"
          alignItems="center"
          flex={1}
        >
          <Link color="base.content.default" onClick={onAnnouncementModalOpen}>
            Learn how to use this action
          </Link>
        </Flex>
      </Infobox>

      {isAnnouncementModalOpen && announcementContentKey && (
        <AnnouncementModal
          isOpen={isAnnouncementModalOpen}
          onClose={onAnnouncementModalClose}
          announcementContentKey={announcementContentKey}
        />
      )}
    </>
  )
}
