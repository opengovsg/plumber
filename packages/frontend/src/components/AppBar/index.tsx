import { Box, Divider, Flex, Image, Text } from '@chakra-ui/react'
import { Button, Link } from '@opengovsg/design-system-react'
import mainLogo from 'assets/logo.svg'
import AvatarDropdownMenu from 'components/AvatarDropdownMenu'
import NewsDrawer from 'components/NewsDrawer'
import * as URLS from 'config/urls'

export default function AppBar(): React.ReactElement {
  return (
    <Box maxW="full">
      <Flex alignItems="center" pl={6} pr={3} py={4} gap={{ base: 3, sm: 6 }}>
        <Box flexGrow="1" flexShrink="0">
          <Image src={mainLogo} h={8} w={8} />
        </Box>

        <Button
          as={Link}
          href={URLS.STATUS_LINK}
          colorScheme="secondary"
          target="_blank"
          variant="link"
          _hover={{ textDecoration: 'underline' }}
        >
          <Text textStyle="subhead-1">Status</Text>
        </Button>

        <Button
          as={Link}
          href={URLS.GUIDE_LINK}
          colorScheme="secondary"
          target="_blank"
          variant="link"
          _hover={{ textDecoration: 'underline' }}
        >
          <Text textStyle="subhead-1">Guide</Text>
        </Button>

        <NewsDrawer />

        <AvatarDropdownMenu />
      </Flex>
      <Divider borderColor="base.divider.subtle" />
    </Box>
  )
}
