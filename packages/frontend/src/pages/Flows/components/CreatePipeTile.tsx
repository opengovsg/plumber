import { Box, Flex, Text } from '@chakra-ui/react'
import { Tile } from '@opengovsg/design-system-react'

import { TemplateIcon } from '@/helpers/flow-templates'

export interface TileProps {
  header: string
  description: string
  iconName: string
  onClick: () => void
}

export default function CreatePipeTile(props: TileProps) {
  const { header, description, iconName, onClick } = props
  return (
    <Tile
      icon={() => (
        <Box py={2}>
          <TemplateIcon iconName={iconName} fontSize="2rem" />
        </Box>
      )}
      display="flex"
      flex="1"
      onClick={onClick}
    >
      <Flex flexDir="column" gap={2} mt={2}>
        <Text textStyle="subhead-1">{header}</Text>
        <Text textStyle="body-2">{description}</Text>
      </Flex>
    </Tile>
  )
}
