import type { ITemplate } from '@plumber/types'

import { useContext } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Flex, Grid, Text } from '@chakra-ui/react'
import { Link } from '@opengovsg/design-system-react'

import Container from '@/components/Container'
import PageTitle from '@/components/PageTitle'
import * as URLS from '@/config/urls'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'
import { GET_TEMPLATES } from '@/graphql/queries/get-templates'
import { useApps } from '@/hooks/useApps'

import TemplateModal from '../Template'

import TemplateTile from './components/TemplateTile'
import TemplateTileSkeleton from './components/TemplateTileSkeleton'

const TEMPLATES_TITLE = 'Templates'
const TEMPLATES_COUNT = 9

export default function Templates(): JSX.Element {
  const { data, loading: templatesLoading } = useQuery(GET_TEMPLATES)

  // TODO (kevinkim-ogp): remove this when Pair is released to all users
  // we do this to avoid adding extra flags or parameters into the query
  const { getFlagValue } = useContext(LaunchDarklyContext)
  const isPairEnabled = getFlagValue('app_pair') as boolean
  const templates: ITemplate[] =
    data?.getTemplates?.filter((template: ITemplate) => {
      if (isPairEnabled) {
        return template.id !== '2a84e2f6-4806-46a2-890a-0dba1411b12f' // ROUTE_SUPPORT_ENQUIRIES_TEMPLATE
      } else if (!isPairEnabled) {
        return template.id !== '8f0a3052-db94-45de-b984-29647f2b09c9' // ROUTE_SUPPORT_ENQUIRIES_WITH_PAIR_TEMPLATE
      }
      return true
    }) ?? []
  const { templateId } = useParams()
  const template = templates?.find((template) => template.id === templateId)

  const { data: apps, loading: appsLoading } = useApps()

  return (
    <>
      <Container py={9}>
        <Flex flexDir="column" mb={8} rowGap={2}>
          <PageTitle title={TEMPLATES_TITLE} />
          <Text
            textStyle="body-1"
            pl={{ base: 2, md: 8 }}
            mt={{ base: -10, md: -6 }}
          >
            Pre-built pipes that you can use as is or customise further for your
            own use case
          </Text>
        </Flex>

        <Grid
          gridTemplateColumns={{
            base: '1fr',
            md: '1fr 1fr',
            lg: '1fr 1fr 1fr',
          }}
          pl={{ base: '0.5rem', md: '2rem', xl: '3.5rem' }}
          pr={{ base: '0.5rem', md: '2rem', xl: '8.5rem' }}
          columnGap={10}
          rowGap={6}
          mb={8}
        >
          {templatesLoading || appsLoading
            ? Array.from({ length: TEMPLATES_COUNT }).map((_, index) => (
                <TemplateTileSkeleton key={index} />
              ))
            : templates?.map((template, index) => (
                <TemplateTile key={index} template={template} />
              ))}
        </Grid>

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

      {template && <TemplateModal template={template} apps={apps} />}
    </>
  )
}
