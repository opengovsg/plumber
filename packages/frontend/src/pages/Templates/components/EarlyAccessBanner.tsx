import { Flex, Icon, Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import { BiTestTube } from 'react-icons/bi'

import * as URLS from '@/config/urls'

export default function EarlyAccessBanner(): JSX.Element {
  return (
    <Flex
      alignItems="center"
      columnGap={4}
      rowGap={3}
      flexWrap="wrap"
      px={4}
      py={3}
      bg="primary.50"
      border="1px solid"
      borderColor="primary.100"
      borderRadius="md"
    >
      <Icon as={BiTestTube} boxSize={5} color="primary.600" />
      <Flex flexDir="column" flex={1} minW="12rem">
        <Text textStyle="subhead-2" color="base.content.strong">
          You’re seeing this because you joined early access
        </Text>
        <Text textStyle="body-2" color="base.content.medium">
          Made by other public officers. Tell us if they’re useful.
        </Text>
      </Flex>
      <Button
        as="a"
        href={URLS.FEEDBACK_FORM_LINK}
        target="_blank"
        rel="noopener noreferrer"
        variant="outline"
        size="sm"
      >
        Share feedback
      </Button>
    </Flex>
  )
}
