import { Box, Flex, ModalCloseButton, ModalHeader } from '@chakra-ui/react'
import type { ITemplate } from '@plumber/types'

import DebouncedSearchInput from '@/components/DebouncedSearchInput'
import BackButton from '@/components/FlowStepConfigurationModal/BackButton'
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
      <Flex
        flexDir="column"
        alignItems="flex-start"
        gap={2}
        py={6}
        pl={8}
        pr={16}
      >
        <BackButton onBack={onBack} />
        <ModalHeader p={0} textStyle="h4">
          Choose a template
        </ModalHeader>
      </Flex>
      <ModalCloseButton top="1.625rem" right={4} />

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
