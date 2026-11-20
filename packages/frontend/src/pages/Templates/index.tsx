import { useQuery } from '@apollo/client'
import { Box, Flex, Grid, Icon, Image, Text } from '@chakra-ui/react'
import { Badge, Link } from '@opengovsg/design-system-react'
import type { ITemplate } from '@plumber/types'
import { useFeatureFlagEnabled, usePostHog } from 'posthog-js/react'
import { useContext, useState } from 'react'
import { BiGroup } from 'react-icons/bi'
import { useParams } from 'react-router-dom'

import mainLogo from '@/assets/logo.svg'
import Container from '@/components/Container'
import DebouncedSearchInput from '@/components/DebouncedSearchInput'
import PageTitle from '@/components/PageTitle'
import * as URLS from '@/config/urls'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'
import { GET_TEMPLATES } from '@/graphql/queries/get-templates'
import { useApps } from '@/hooks/useApps'
import { useTemplateSearch } from '@/hooks/useTemplateSearch'

import TemplateModal from '../Template'
import CommunityTemplatesSkeleton from './components/CommunityTemplatesSkeleton'
import EarlyAccessBanner from './components/EarlyAccessBanner'
import EarlyAccessModal from './components/EarlyAccessModal'
import OptInDialog from './components/OptInDialog'
import TemplateSection from './components/TemplateSection'
import TemplateTile from './components/TemplateTile'
import TemplateTileSkeleton from './components/TemplateTileSkeleton'

const TEMPLATES_TITLE = 'Templates'
const TEMPLATES_COUNT = 9
const SEARCH_RESULTS_COUNT = 5
const COMMUNITY_SKELETON_COUNT = 3
// Matches the left padding of PageTitle so content lines up with the heading.
const GUTTER = { base: 2, md: 8 }
const COMMUNITY_TEMPLATES_FLAG = 'templates_early_access'

type ListedTemplate = ITemplate & { isBuiltIn?: boolean }

interface TemplateGridProps {
  templates: ListedTemplate[]
  isLoading: boolean
  skeletonCount: number
}

function TemplateGrid({
  templates,
  isLoading,
  skeletonCount,
}: TemplateGridProps): JSX.Element {
  return (
    <Grid
      gridTemplateColumns={{
        base: '1fr',
        md: '1fr 1fr',
        lg: '1fr 1fr 1fr',
      }}
      gap={6}
    >
      {isLoading
        ? Array.from({ length: skeletonCount }).map((_, index) => (
            <TemplateTileSkeleton key={index} />
          ))
        : templates.map((template) => (
            <TemplateTile key={template.id} template={template} />
          ))}
    </Grid>
  )
}

export default function Templates(): JSX.Element {
  const { data, loading: templatesLoading } = useQuery(GET_TEMPLATES)

  // TODO (kevinkim-ogp): remove this when Pair is released to all users
  // we do this to avoid adding extra flags or parameters into the query
  const { getFlagValue } = useContext(LaunchDarklyContext)
  const isPairEnabled = getFlagValue('app_pair') as boolean
  const templates: ListedTemplate[] =
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
  const posthog = usePostHog()
  const earlyAccessFlag = useFeatureFlagEnabled(COMMUNITY_TEMPLATES_FLAG)
  const isEarlyAccessEnabled = earlyAccessFlag === true
  const enrolInEarlyAccess = () =>
    posthog.updateEarlyAccessFeatureEnrollment(COMMUNITY_TEMPLATES_FLAG, true)

  const [searchQuery, setSearchQuery] = useState('')
  const isSearching = searchQuery.trim() !== ''
  const {
    templateIds: matchedTemplateIds,
    loading: searchLoading,
    error: searchError,
  } = useTemplateSearch(searchQuery)
  // Ranking runs over every template, so drop the ones this user cannot see
  // before taking the top results.
  const matchedTemplates = matchedTemplateIds
    .flatMap((id) => templates.find((template) => template.id === id) ?? [])
    .slice(0, SEARCH_RESULTS_COUNT)

  const isLoading = templatesLoading || appsLoading || searchLoading
  const builtInTemplates = templates.filter((template) => template.isBuiltIn)
  const communityTemplates = templates.filter((template) => !template.isBuiltIn)
  const showCommunity =
    isEarlyAccessEnabled && (isLoading || communityTemplates.length > 0)
  const showCommunitySkeleton = earlyAccessFlag === false

  return (
    <>
      <Container py={9}>
        <Flex flexDir="column" mb={8} rowGap={2}>
          <PageTitle
            title={TEMPLATES_TITLE}
            searchComponent={
              <DebouncedSearchInput
                searchValue={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search templates"
              />
            }
          />
          <Text textStyle="body-1" pl={GUTTER} mt={{ base: -10, md: -6 }}>
            Start from a ready-made pipe, then customise it for your use case
          </Text>
        </Flex>

        <Box px={GUTTER} mb={8}>
          {isSearching ? (
            <>
              {!isLoading && matchedTemplates.length === 0 && (
                <Text textStyle="body-1" mb={8}>
                  {searchError
                    ? 'Template search is unavailable. Try again later.'
                    : 'No matching templates found.'}
                </Text>
              )}
              <TemplateGrid
                templates={matchedTemplates}
                isLoading={isLoading}
                skeletonCount={SEARCH_RESULTS_COUNT}
              />
            </>
          ) : (
            <>
              <TemplateSection
                icon={<Image src={mainLogo} alt="" boxSize={5} />}
                title="Made by Plumber"
                count={isLoading ? undefined : builtInTemplates.length}
              >
                <TemplateGrid
                  templates={builtInTemplates}
                  isLoading={isLoading}
                  skeletonCount={TEMPLATES_COUNT}
                />
              </TemplateSection>

              {showCommunity ? (
                <TemplateSection
                  icon={
                    <Icon
                      as={BiGroup}
                      boxSize={5}
                      color="base.content.medium"
                    />
                  }
                  title="From the community"
                  badge={
                    <Badge
                      bg="primary.100"
                      color="primary.600"
                      textTransform="uppercase"
                    >
                      Early access
                    </Badge>
                  }
                  count={isLoading ? undefined : communityTemplates.length}
                  description="Templates from other public officers. Review each step before you use it."
                >
                  <EarlyAccessBanner />
                  <TemplateGrid
                    templates={communityTemplates}
                    isLoading={isLoading}
                    skeletonCount={COMMUNITY_SKELETON_COUNT}
                  />
                </TemplateSection>
              ) : (
                showCommunitySkeleton && (
                  <CommunityTemplatesSkeleton onTurnOn={enrolInEarlyAccess} />
                )
              )}
            </>
          )}
        </Box>

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
      <OptInDialog onOptIn={enrolInEarlyAccess} />
      <EarlyAccessModal onTurnOn={enrolInEarlyAccess} />
    </>
  )
}
