import { Flex, Grid, GridProps, Text } from '@chakra-ui/react'
import type { ITemplate } from '@plumber/types'

import TemplateTile from './TemplateTile'
import TemplateTileSkeleton from './TemplateTileSkeleton'

interface TemplateResultsProps {
  templates: ITemplate[]
  isLoading: boolean
  skeletonCount: number
  isSearching: boolean
  searchError: Error | null
  onSelectTemplate: (template: ITemplate) => void
  gap: GridProps['gap']
}

export default function TemplateResults(props: TemplateResultsProps) {
  const {
    templates,
    isLoading,
    skeletonCount,
    isSearching,
    searchError,
    onSelectTemplate,
    gap,
  } = props

  return (
    <Flex flexDir="column" rowGap={8}>
      {isSearching && !isLoading && templates.length === 0 && (
        <Text textStyle="body-1">
          {searchError
            ? 'Template search is unavailable. Try again later.'
            : 'No matching templates found.'}
        </Text>
      )}

      <Grid
        gridTemplateColumns={{
          base: '1fr',
          md: '1fr 1fr',
          lg: '1fr 1fr 1fr',
        }}
        gap={gap}
      >
        {isLoading
          ? Array.from({ length: skeletonCount }).map((_, index) => (
              <TemplateTileSkeleton key={index} />
            ))
          : templates.map((template) => (
              <TemplateTile
                key={template.id}
                template={template}
                onSelect={() => onSelectTemplate(template)}
              />
            ))}
      </Grid>
    </Flex>
  )
}
