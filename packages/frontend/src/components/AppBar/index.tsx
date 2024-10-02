import { Box, Divider, Flex, Hide, Image, Show, Text } from '@chakra-ui/react'
import { Button, Link } from '@opengovsg/design-system-react'

import mainLogo from '@/assets/logo.svg'
import AvatarDropdownMenu from '@/components/AvatarDropdownMenu'
import NewsDrawer from '@/components/NewsDrawer'
import * as URLS from '@/config/urls'

import NavigationDrawer from '../Layout/NavigationDrawer'

const AppBarTextStyles = {
  base: 'subhead-2',
  sm: 'subhead-1',
}

export default function AppBar(): React.ReactElement {
  return (
    <Box maxW="full">
      <Flex
        alignItems="center"
        pl={{
          base: 3,
          sm: 6,
        }}
        pr={3}
        py={4}
        gap={{ base: 3, sm: 6 }}
      >
        <Box flexGrow="1" flexShrink="0">
          <Show above="sm">
            <Image src={mainLogo} h={8} w={8} />
          </Show>
          <Hide above="sm">
            <NavigationDrawer />
          </Hide>
        </Box>

        <Button
          as={Link}
          href={URLS.STATUS_LINK}
          colorScheme="secondary"
          target="_blank"
          variant="link"
        >
          <Text textStyle={AppBarTextStyles}>Status</Text>
        </Button>

        <Button
          as={Link}
          href={URLS.GUIDE_LINK}
          colorScheme="secondary"
          target="_blank"
          variant="link"
        >
          <Text textStyle={AppBarTextStyles}>Guide</Text>
        </Button>

        <NewsDrawer>
          <Text textStyle={AppBarTextStyles}>{`What's New`}</Text>
        </NewsDrawer>

        <AvatarDropdownMenu />
      </Flex>
      <Divider borderColor="base.divider.medium" />
    </Box>
  )
}
