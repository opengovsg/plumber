import { Box, Flex, ModalHeader } from '@chakra-ui/react'
import type { ITemplate } from '@plumber/types'

import DebouncedSearchInput from '@/components/DebouncedSearchInput'
import BackAndCloseRow from '@/pages/Template/components/BackAndCloseRow'
import TemplateResults from '@/pages/Templates/components/TemplateResults'
import type { TemplateBrowser } from '@/pages/Templates/hooks/useTemplateBrowser'

interface TemplatePickerProps {
  browser: TemplateBrowser
  isLoading: boolean
  onBack: () => void
  onSelectTemplate: (template: ITemplate) => void
}

export default function TemplatePicker(props: TemplatePickerProps) {
  const { browser, isLoading, onBack, onSelectTemplate } = props

  return (
    <Flex flexDir="column" flex={1} minH={0}>
      <Box pt={6}>
        <BackAndCloseRow onBack={onBack} />
      </Box>
      <ModalHeader
        px={8}
        pt={2}
        pb={6}
        textStyle="h4"
        fontWeight={600}
        fontSize="1.5rem"
      >
        Choose a template
      </ModalHeader>

      <Box px={8} pb={6}>
        <DebouncedSearchInput
          searchValue={browser.searchQuery}
          onChange={browser.setSearchQuery}
          placeholder="Describe your workflow"
          minW={0}
          flushOnUnmount
        />
      </Box>

      <Box flex={1} minH={0} overflowY="auto" px={8} pb={8}>
        <TemplateResults
          templates={browser.visibleTemplates}
          isLoading={isLoading}
          skeletonCount={browser.skeletonCount}
          isSearching={browser.isSearching}
          searchError={browser.searchError}
          onSelectTemplate={onSelectTemplate}
          gap={4}
        />
      </Box>
    </Flex>
  )
}
