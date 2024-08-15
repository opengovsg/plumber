import { Center, Flex, Hide, Image, Text } from '@chakra-ui/react'
import { Badge, Link } from '@opengovsg/design-system-react'

import templatesPreviewImg from '@/assets/templates-preview.svg'
import Container from '@/components/Container'
import NavigationDrawer from '@/components/Layout/NavigationDrawer'
import * as URLS from '@/config/urls'

export default function Templates(): JSX.Element {
  return (
    <Container w={{ base: '90%', md: '60%', lg: '50%' }}>
      <Hide above="sm">
        <NavigationDrawer />
      </Hide>
      <Center mt={{ base: '1rem', sm: '3rem' }}>
        <Image src={templatesPreviewImg} alt="template-preview" />
      </Center>
      <Flex
        flexDir="column"
        justifyContent="center"
        rowGap={4}
        alignItems="center"
      >
        <Badge bgColor="interaction.muted.main.active" color="primary.500">
          Coming soon!
        </Badge>
        <Text textStyle="h3-semibold" textAlign="center">
          Templates are pre-built pipes that you can use as is or customise
          further
        </Text>
        <Flex
          flexDir={{ base: 'column', sm: 'row' }}
          justifyContent="center"
          alignItems="center"
        >
          <Text whiteSpace="pre-wrap">{`Need a template? `}</Text>
          <Link
            href={URLS.TEMPLATES_FORM_LINK}
            isExternal
            color="interaction.links.neutral-default"
          >
            Let us know
          </Link>
        </Flex>
      </Flex>
    </Container>
  )
}
