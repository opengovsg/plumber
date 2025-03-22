import { Flex, ModalBody, Text } from '@chakra-ui/react'

import { SUPPORT_FORM_LINK } from '@/config/urls'

export default function InvalidModalScreen(): JSX.Element {
  return (
    <ModalBody my={12}>
      <Flex flexDir="column" textAlign="center" gap={2}>
        <Text textStyle="h4">Error</Text>
        <Text textStyle="body-1">
          This should not appear, please send a screenshot with the pipe id to{' '}
          <Text as="a" href={SUPPORT_FORM_LINK} target="_blank">
            {SUPPORT_FORM_LINK}
          </Text>
        </Text>
      </Flex>
    </ModalBody>
  )
}
