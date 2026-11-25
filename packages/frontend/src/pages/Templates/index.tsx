import { Box, Flex, Text } from '@chakra-ui/react'
import { Link } from '@opengovsg/design-system-react'
import { useNavigate, useParams } from 'react-router-dom'

import Container from '@/components/Container'
import DebouncedSearchInput from '@/components/DebouncedSearchInput'
import PageTitle from '@/components/PageTitle'
import * as URLS from '@/config/urls'
import { useApps } from '@/hooks/useApps'

import TemplateModal from '../Template'
import TemplateResults from './components/TemplateResults'
import { useTemplateBrowser } from './hooks/useTemplateBrowser'

const TEMPLATES_TITLE = 'Templates'
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

  return (
    <>
      <Container py={9}>
        <Flex flexDir="column" mb={8} rowGap={2}>
          <PageTitle title={TEMPLATES_TITLE} />
          <Text textStyle="body-1" pl={GUTTER} mt={{ base: -10, md: -6 }}>
            Pre-built pipes that you can use as is or customise further for your
            own use case
          </Text>
        </Flex>

        <Box px={GUTTER} mb={6}>
          <DebouncedSearchInput
            searchValue={searchQuery}
            onChange={setSearchQuery}
            placeholder="Describe your workflow"
          />
        </Box>

        <Box px={GUTTER} mb={8}>
          <TemplateResults
            templates={visibleTemplates}
            isLoading={templatesLoading || appsLoading}
            skeletonCount={skeletonCount}
            isSearching={isSearching}
            searchError={searchError}
            onSelectTemplate={(template) =>
              navigate(URLS.TEMPLATE(template.id))
            }
            gap={6}
          />
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
    </>
  )
}
