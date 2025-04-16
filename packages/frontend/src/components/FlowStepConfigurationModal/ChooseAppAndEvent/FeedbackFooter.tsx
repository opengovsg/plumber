import { BiLinkExternal } from 'react-icons/bi'
import { Icon, Link, ModalFooter, Text } from '@chakra-ui/react'

import * as URLS from '@/config/urls'

export default function FeedbackFooter() {
  return (
    <ModalFooter justifyContent="center" gap={1} pb={0}>
      <Text textStyle="caption-1">{`Can't find what you need?`}</Text>
      <Link
        href={URLS.FEEDBACK_FORM_LINK}
        isExternal
        color="interaction.links.neutral-default"
        display="flex"
        alignItems="center"
        gap={1}
      >
        <Text textStyle="caption-1">Let us know</Text>
        <Icon as={BiLinkExternal} />
      </Link>
    </ModalFooter>
  )
}
