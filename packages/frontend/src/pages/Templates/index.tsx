import { AbsoluteCenter, Box, Flex, Grid, Text } from '@chakra-ui/react'
import { Link, Tile } from '@opengovsg/design-system-react'

import Container from '@/components/Container'
import PageTitle from '@/components/PageTitle'
import * as URLS from '@/config/urls'
import { FALLBACK_ICON, TEMPLATE_ICONS_MAP } from '@/helpers/flow-templates'

import { TEMPLATES } from './templates-data'

const TEMPLATES_TITLE = 'Templates'

export default function Templates(): JSX.Element {
  // Sanity check if our templates file is missing
  if (!TEMPLATES || TEMPLATES.length === 0) {
    return (
      <Box position="relative" h="100%">
        <AbsoluteCenter>
          <Text>
            There are no templates now, please contact support@plumber.gov.sg
          </Text>
        </AbsoluteCenter>
      </Box>
    )
  }

  return (
    <Container
      py={9}
      pl={{ base: '2rem', xl: '3.5rem' }}
      pr={{ base: '2rem', xl: '8.5rem' }}
    >
      <Flex flexDir="column" mb={8} rowGap={2}>
        <PageTitle title={TEMPLATES_TITLE} />
        <Text textStyle="body-1">
          Pre-built pipes that you can use as is or customise further for your
          own use case
        </Text>
      </Flex>

      <Grid
        gridTemplateColumns={{ base: '1fr', md: '1fr 1fr', xl: '1fr 1fr 1fr' }}
        columnGap={10}
        rowGap={6}
        mb={8}
      >
        {/* TODO (mal): add onClick in a later PR */}
        {TEMPLATES.map((template, index) => (
          <Tile
            key={index}
            icon={() => (
              <Box bg="primary.100" p={2} borderRadius={4}>
                {TEMPLATE_ICONS_MAP[template.id] ?? FALLBACK_ICON}
              </Box>
            )}
          >
            <Flex flexDir="column" gap={2} mt={2}>
              <Text textStyle="subhead-1">{template.name}</Text>
              <Text textStyle="body-2">{template.description}</Text>
            </Flex>
          </Tile>
        ))}
      </Grid>

      <Flex
        flexDir={{ base: 'column', md: 'row' }}
        justifyContent="center"
        alignItems="center"
        textStyle="body-2"
      >
        <Text whiteSpace="pre-wrap">{`Can’t find what you’re looking for? `}</Text>
        <Link href={URLS.TEMPLATES_FORM_LINK} isExternal textDecoration="none">
          Request a template
        </Link>
      </Flex>
    </Container>
  )
}
