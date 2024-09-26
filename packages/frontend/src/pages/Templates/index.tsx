import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Box, Center, Flex, Grid, Text } from '@chakra-ui/react'
import { Link, Tile } from '@opengovsg/design-system-react'

import Container from '@/components/Container'
import PageTitle from '@/components/PageTitle'
import PrimarySpinner from '@/components/PrimarySpinner'
import * as URLS from '@/config/urls'
import { Template } from '@/graphql/__generated__/graphql'
import { GET_TEMPLATES } from '@/graphql/queries/get-templates'
import { TemplateIcon } from '@/helpers/flow-templates'

import TemplateModal from '../Template'

const TEMPLATES_TITLE = 'Templates'

export default function Templates(): JSX.Element {
  const navigate = useNavigate()
  const { data, loading } = useQuery(GET_TEMPLATES)

  const templates: Template[] = data?.getTemplates
  const { templateId } = useParams()
  const template = templates?.find((template) => template.id === templateId)
  return (
    <>
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

        {loading ? (
          <Center my={12}>
            <PrimarySpinner fontSize="4xl" />
          </Center>
        ) : (
          <Grid
            gridTemplateColumns={{
              base: '1fr',
              md: '1fr 1fr',
              xl: '1fr 1fr 1fr',
            }}
            columnGap={10}
            rowGap={6}
            mb={8}
          >
            {templates.map((template, index) => (
              <Tile
                key={index}
                icon={() => (
                  <Box bg="primary.100" p={2} borderRadius={4}>
                    {<TemplateIcon iconName={template.iconName} />}
                  </Box>
                )}
                onClick={() => navigate(URLS.TEMPLATE(template.id))}
              >
                <Flex flexDir="column" gap={2} mt={2}>
                  <Text textStyle="subhead-1">{template.name}</Text>
                  <Text textStyle="body-2">{template.description}</Text>
                </Flex>
              </Tile>
            ))}
          </Grid>
        )}

        <Flex
          flexDir={{ base: 'column', md: 'row' }}
          justifyContent="center"
          alignItems="center"
          textStyle="body-2"
        >
          <Text whiteSpace="pre-wrap">{`Can’t find what you’re looking for? `}</Text>
          <Link
            href={URLS.TEMPLATES_FORM_LINK}
            isExternal
            textDecoration="none"
          >
            Request a template
          </Link>
        </Flex>
      </Container>

      {template && <TemplateModal template={template} />}
    </>
  )
}
