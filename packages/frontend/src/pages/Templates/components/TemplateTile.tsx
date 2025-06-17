import type { ITemplate } from '@plumber/types'

import { useNavigate } from 'react-router-dom'
import { Box, Flex, Text } from '@chakra-ui/react'
import { Badge, Tile } from '@opengovsg/design-system-react'

import * as URLS from '@/config/urls'
import { TemplateIcon } from '@/helpers/flow-templates'

interface TemplateTileProps {
  template: ITemplate
}

export default function TemplateTile({ template }: TemplateTileProps) {
  const { id, name, description, iconName, tags } = template
  const navigate = useNavigate()

  const isDemoTemplate = tags?.some((tag) => tag === 'demo')
  const isNewTemplate = tags?.some((tag) => tag === 'new')

  return (
    <Tile
      icon={() => (
        <Box py={2}>
          <TemplateIcon iconName={iconName} fontSize="2rem" />
        </Box>
      )}
      badge={
        isDemoTemplate || isNewTemplate ? (
          <Badge bg="primary.100" color="primary.500">
            {isDemoTemplate ? 'Demo included' : 'New'}
          </Badge>
        ) : undefined
      }
      display="flex"
      onClick={() => navigate(URLS.TEMPLATE(id))}
    >
      <Flex flexDir="column" gap={2} mt={2}>
        <Text textStyle="subhead-1">{name}</Text>
        <Text textStyle="body-2">{description}</Text>
      </Flex>
    </Tile>
  )
}
