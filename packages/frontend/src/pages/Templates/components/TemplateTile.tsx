import { Box, Flex, Text } from '@chakra-ui/react'
import { Badge, Tile } from '@opengovsg/design-system-react'
import type { ITemplate } from '@plumber/types'

import { getTemplateIconName, TemplateIcon } from '@/helpers/flow-templates'

interface TemplateTileProps {
  template: ITemplate & { isBuiltIn?: boolean }
  onSelect: () => void
}

export default function TemplateTile({
  template,
  onSelect,
}: TemplateTileProps) {
  const { id, name, description, iconName, tags, isBuiltIn } = template

  const isDemoTemplate = tags?.some((tag) => tag === 'demo')
  const isNewTemplate = tags?.some((tag) => tag === 'new')

  return (
    <Tile
      icon={() => (
        <Box py={2}>
          <TemplateIcon
            iconName={getTemplateIconName({ id, iconName, isBuiltIn })}
            fontSize="2rem"
          />
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
      onClick={onSelect}
    >
      <Flex flexDir="column" gap={2} mt={2}>
        <Text textStyle="subhead-1">{name}</Text>
        <Text textStyle="body-2" color="base.content.medium">
          {description}
        </Text>
      </Flex>
    </Tile>
  )
}
