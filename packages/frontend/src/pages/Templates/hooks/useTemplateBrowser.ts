import { useQuery } from '@apollo/client'
import type { ITemplate } from '@plumber/types'
import { useContext, useState } from 'react'

import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'
import { GET_TEMPLATES } from '@/graphql/queries/get-templates'
import { useTemplateSearch } from '@/hooks/useTemplateSearch'

import { getSearchResults } from '../helpers/get-search-results'

const TEMPLATES_COUNT = 9
const SEARCH_RESULTS_COUNT = 5

const ROUTE_SUPPORT_ENQUIRIES_TEMPLATE_ID =
  '2a84e2f6-4806-46a2-890a-0dba1411b12f'
const ROUTE_SUPPORT_ENQUIRIES_WITH_PAIR_TEMPLATE_ID =
  '8f0a3052-db94-45de-b984-29647f2b09c9'

/**
 * Loads the templates this user can see and ranks them against a search query.
 */
export function useTemplateBrowser() {
  const { data, loading: templatesLoading } = useQuery(GET_TEMPLATES)

  // TODO (kevinkim-ogp): remove this when Pair is released to all users
  // we do this to avoid adding extra flags or parameters into the query
  const { getFlagValue } = useContext(LaunchDarklyContext)
  const isPairEnabled = getFlagValue('app_pair') as boolean
  const templates: ITemplate[] =
    data?.getTemplates?.filter((template: ITemplate) =>
      isPairEnabled
        ? template.id !== ROUTE_SUPPORT_ENQUIRIES_TEMPLATE_ID
        : template.id !== ROUTE_SUPPORT_ENQUIRIES_WITH_PAIR_TEMPLATE_ID,
    ) ?? []

  const [searchQuery, setSearchQuery] = useState('')
  const isSearching = searchQuery.trim() !== ''
  const {
    templateIds: matchedTemplateIds,
    loading: searchLoading,
    error: searchError,
  } = useTemplateSearch(searchQuery)

  const matchedTemplates = getSearchResults({
    matchedTemplateIds,
    templates,
    limit: SEARCH_RESULTS_COUNT,
  })

  return {
    templates,
    visibleTemplates: isSearching ? matchedTemplates : templates,
    searchQuery,
    setSearchQuery,
    isSearching,
    isLoading: templatesLoading || searchLoading,
    searchError,
    skeletonCount: isSearching ? SEARCH_RESULTS_COUNT : TEMPLATES_COUNT,
  }
}

export type TemplateBrowser = ReturnType<typeof useTemplateBrowser>
