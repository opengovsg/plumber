import { Center, chakra, Flex, Hide, Image, Text } from '@chakra-ui/react'
import { Badge, Link } from '@opengovsg/design-system-react'

import templatesPreviewImg from '@/assets/templates-preview.svg'
import Container from '@/components/Container'
import NavigationDrawer from '@/components/Layout/NavigationDrawer'
import MarkdownRenderer from '@/components/MarkdownRenderer'
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
        <MarkdownRenderer
          source={`Need a template? [Let us know](${URLS.TEMPLATES_FORM_LINK})`}
          components={{
            a: ({ ...props }) => (
              <Link
                isExternal
                color="interaction.links.neutral-default"
                _hover={{ color: 'interaction.links.neutral-hover' }}
                {...props}
              />
            ),
            p: ({ ...props }) => <chakra.p {...props} />,
          }}
        />
      </Flex>
    </Container>
  )
}
