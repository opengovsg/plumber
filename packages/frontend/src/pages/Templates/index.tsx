import { Box, Flex, Icon, Image, Text } from '@chakra-ui/react'
import { Link } from '@opengovsg/design-system-react'
import type { ITemplate } from '@plumber/types'
import { BiGroup } from 'react-icons/bi'
import { useNavigate, useParams } from 'react-router-dom'

import mainLogo from '@/assets/logo.svg'
import Container from '@/components/Container'
import DebouncedSearchInput from '@/components/DebouncedSearchInput'
import PageTitle from '@/components/PageTitle'
import * as URLS from '@/config/urls'
import { useApps } from '@/hooks/useApps'

import TemplateModal from '../Template'
import CommunityFeedbackBanner from './components/CommunityFeedbackBanner'
import CommunityTemplatesModal from './components/CommunityTemplatesModal'
import TemplateResults from './components/TemplateResults'
import TemplateSection from './components/TemplateSection'
import type { ListedTemplate } from './helpers/get-search-results'
import { useTemplateBrowser } from './hooks/useTemplateBrowser'

const TEMPLATES_TITLE = 'Templates'
const TEMPLATES_COUNT = 9
const COMMUNITY_SKELETON_COUNT = 3
// Matches the left padding of PageTitle so content lines up with the heading.
const GUTTER = { base: 2, md: 8 }

export default function Templates(): JSX.Element {
  const navigate = useNavigate()
  const {
    templates,
    visibleTemplates,
    setSearchQuery,
    searchQuery,
    isSearching,
    isLoading: templatesLoading,
    searchError,
    skeletonCount,
  } = useTemplateBrowser()
  const { data: apps, loading: appsLoading } = useApps()

  const { templateId } = useParams()
  const template = templates.find((template) => template.id === templateId)

  const isLoading = templatesLoading || appsLoading
  const listedTemplates: ListedTemplate[] = templates
  const builtInTemplates = listedTemplates.filter(
    (template) => template.isBuiltIn,
  )
  const communityTemplates = listedTemplates.filter(
    (template) => !template.isBuiltIn,
  )
  const showCommunity = isLoading || communityTemplates.length > 0
  const onSelectTemplate = (template: ITemplate) =>
    navigate(URLS.TEMPLATE(template.id))

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
            <TemplateResults
              templates={visibleTemplates}
              isLoading={isLoading}
              skeletonCount={skeletonCount}
              isSearching
              searchError={searchError}
              onSelectTemplate={onSelectTemplate}
              gap={6}
            />
          ) : (
            <>
              <TemplateSection
                icon={<Image src={mainLogo} alt="" boxSize={5} />}
                title="Made by Plumber"
                count={isLoading ? undefined : builtInTemplates.length}
              >
                <TemplateResults
                  templates={builtInTemplates}
                  isLoading={isLoading}
                  skeletonCount={TEMPLATES_COUNT}
                  isSearching={false}
                  searchError={null}
                  onSelectTemplate={onSelectTemplate}
                  gap={6}
                />
              </TemplateSection>

              {showCommunity && (
                <TemplateSection
                  icon={
                    <Icon
                      as={BiGroup}
                      boxSize={5}
                      color="base.content.medium"
                    />
                  }
                  title="From the community"
                  count={isLoading ? undefined : communityTemplates.length}
                  description="Templates from other public officers. Review each step before you use it."
                >
                  <CommunityFeedbackBanner />
                  <TemplateResults
                    templates={communityTemplates}
                    isLoading={isLoading}
                    skeletonCount={COMMUNITY_SKELETON_COUNT}
                    isSearching={false}
                    searchError={null}
                    onSelectTemplate={onSelectTemplate}
                    gap={6}
                  />
                </TemplateSection>
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
      {/* Only once there are community templates to point at. */}
      {!templatesLoading && communityTemplates.length > 0 && (
        <CommunityTemplatesModal />
      )}
    </>
  )
}
