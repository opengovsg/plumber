import type { IApp, ITemplateStep } from '@plumber/types'

import { useMemo } from 'react'
import { Flex, Text } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'

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
      flexDir="column"
      justifyContent="center"
      alignItems="center"
      w={{ base: '100%', md: '90%', lg: '60%' }}
      mx="auto"
      py={{ base: '0.75rem', md: '1.5rem' }}
    >
      <Infobox icon={<></>} variant="primary" mb={6}>
        <Text textStyle="body-1">
          This is a preview of your workflow. Add details to use this template
          as-is. Or, add more steps to customise it to your use case.
        </Text>
      </Infobox>
      <TemplatePreviewList items={items} apps={apps} />
    </Flex>
  )
}
