import { Center, chakra, Flex, Image, Text } from '@chakra-ui/react'
import { Badge, Link } from '@opengovsg/design-system-react'

import templatesPreviewImg from '@/assets/templates-preview.svg'
import Container from '@/components/Container'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import * as URLS from '@/config/urls'

export default function Templates(): JSX.Element {
  return (
    <Container w="50%">
      <Center mt={12}>
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
