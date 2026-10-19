import { BiBookOpen, BiPlus, BiSolidMagicWand } from 'react-icons/bi'
import { Box, Flex, Text } from '@chakra-ui/react'
import { Badge, Tile, TileProps } from '@opengovsg/design-system-react'

const ICON_SIZE = '1.75rem'

const MODES = {
  ai: {
    title: 'Build with AI',
    description: "Describe your workflow and we'll create the steps for you",
    icon: <BiSolidMagicWand fontSize={ICON_SIZE} />,
    isNew: true,
  },
  template: {
    title: 'Use a template',
    description: 'Choose from a pre-built workflow to customise',
    icon: <BiBookOpen fontSize={ICON_SIZE} />,
    isNew: false,
  },
  new: {
    title: 'Start from scratch',
    description: 'Use our builder to create your own workflow',
    icon: <BiPlus fontSize={ICON_SIZE} />,
    isNew: false,
  },
}

interface ModeTileProps extends Omit<TileProps, 'icon' | 'children'> {
  mode: keyof typeof MODES
}

export default function ModeTile(props: ModeTileProps) {
  const { mode, ...rest } = props

  const { icon, title, description, isNew } = MODES[mode]

  return (
    <Tile
      icon={() => icon}
      flex={{ base: '0 0 auto', md: '1 1 0' }}
      minW={0}
      minH={{ base: 'auto', md: '15rem' }}
      css={{ display: 'flex', justifyContent: 'flex-start' }}
      {...rest}
    >
      <Box pt={{ base: 6, md: 16 }}>
        <Flex align="center" gap={2}>
          <Text textStyle="h6" fontWeight={600} color="base.content.strong">
            {title}
          </Text>
          {isNew && (
            <Badge
              h={5}
              py={0}
              px={1.5}
              alignItems="center"
              bgColor="primary.100"
              color="primary.500"
              fontSize="0.625rem"
              fontWeight={600}
              letterSpacing="0.08em"
            >
              NEW
            </Badge>
          )}
        </Flex>
        <Text textStyle="body-2" color="base.content.medium" mt={2}>
          {description}
        </Text>
      </Box>
    </Tile>
  )
}
