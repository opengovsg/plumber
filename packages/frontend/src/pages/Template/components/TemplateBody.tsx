import { Flex } from '@chakra-ui/react'
import type { IApp, ITemplateStep } from '@plumber/types'
import { useMemo } from 'react'

import { buildTemplatePreview } from '../helpers/template-topology'
import TemplatePreviewList from './TemplatePreviewList'

interface TemplateBodyProps {
  templateSteps: ITemplateStep[]
  apps: IApp[]
}

export default function TemplateBody({
  templateSteps,
  apps,
}: TemplateBodyProps) {
  const items = useMemo(
    () => buildTemplatePreview(templateSteps),
    [templateSteps],
  )

  return (
    <Flex
      // Fills the space above the caption so a short template centres there.
      // A long one outgrows it and scrolls from the top padding.
      flex={1}
      flexDir="column"
      justifyContent="center"
      alignItems="center"
      w={{ base: '100%', md: '90%', lg: '60%' }}
      mx="auto"
      py={10}
    >
      <TemplatePreviewList items={items} apps={apps} />
    </Flex>
  )
}
