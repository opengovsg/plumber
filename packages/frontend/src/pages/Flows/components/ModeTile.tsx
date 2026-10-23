import { TileProps } from '@opengovsg/design-system-react'
import { BiBookOpen, BiPlus, BiSolidMagicWand } from 'react-icons/bi'

import NewBadge from '@/components/FlowStepConfigurationModal/ChooseAppAndEvent/NewBadge'
import OptionTile from '@/components/OptionTile'

const MODES = {
  ai: {
    title: 'Build with AI',
    description: "Describe your workflow and we'll create the steps for you",
    icon: BiSolidMagicWand,
    isNew: true,
  },
  template: {
    title: 'Use a template',
    description: 'Choose from a pre-built workflow to customise',
    icon: BiBookOpen,
    isNew: false,
  },
  new: {
    title: 'Start from scratch',
    description: 'Use our builder to create your own workflow',
    icon: BiPlus,
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
    <OptionTile
      icon={icon}
      title={title}
      description={description}
      badge={isNew ? <NewBadge isCompact /> : undefined}
      {...rest}
    />
  )
}
