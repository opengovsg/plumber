import { Box, Text } from '@chakra-ui/react'
import { Tile, TileProps } from '@opengovsg/design-system-react'
import { BiBookOpen, BiPlus, BiSolidMagicWand } from 'react-icons/bi'

import NewBadge from '@/components/FlowStepConfigurationModal/ChooseAppAndEvent/NewBadge'

const MODES = {
  ai: {
    title: 'Build with AI',
    description: "Describe your workflow and we'll create the steps for you",
    icon: (
      <Box py={2}>
        <BiSolidMagicWand fontSize="2rem" />
      </Box>
    ),
    isNew: true,
  },
  template: {
    title: 'Use a template',
    description: 'Choose from a pre-built workflow to customise',
    icon: (
      <Box py={2}>
        <BiBookOpen fontSize="2rem" />
      </Box>
    ),
    isNew: false,
  },
  new: {
    title: 'Start from scratch',
    description: 'Use our builder to create your own workflow',
    icon: (
      <Box py={2}>
        <BiPlus fontSize="2rem" />
      </Box>
    ),
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
      flex={1}
      {...(isNew && {
        badge: <NewBadge variant="secondary" />,
      })}
      {...rest}
    >
      <Text textStyle="subhead-1">{title}</Text>
      <Text textStyle="body-2">{description}</Text>
    </Tile>
  )
}
