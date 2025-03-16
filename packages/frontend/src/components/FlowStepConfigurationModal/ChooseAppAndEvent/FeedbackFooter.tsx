import { BiLinkExternal } from 'react-icons/bi'
import { Icon, Link, ModalFooter, Text } from '@chakra-ui/react'

import * as URLS from '@/config/urls'

export default function FeedbackFooter() {
  return (
    <ModalFooter justifyContent="center" gap={2}>
      <Text textStyle="caption-1">{`Can't find what you need? Let us know`}</Text>
      <Link
        href={URLS.FEEDBACK_FORM_LINK}
        isExternal
        color="interaction.links.neutral-default"
        mt={1}
      >
        <Icon as={BiLinkExternal} />
      </Link>
    </ModalFooter>
  )
}
