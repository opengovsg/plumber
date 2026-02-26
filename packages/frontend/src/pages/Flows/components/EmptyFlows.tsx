import { useNavigate } from 'react-router-dom'
import { Flex, Text } from '@chakra-ui/react'

import * as URLS from '@/config/urls'

import { useCreateFlowContext } from '../contexts/CreateFlowContext'

import CreatePipeTile, { TileProps } from './CreatePipeTile'

export default function EmptyFlows({ onCreate }: { onCreate: () => void }) {
  const navigate = useNavigate()
  const {
    aiBuilderType,
    canUseAiBuilder,
    setCreateMode,
    setSkipModeSelection,
  } = useCreateFlowContext()

  const TILES = [
    canUseAiBuilder && {
      header: 'Build with AI',
      description:
        'Describe your workflow and we&apos;ll create the steps for you',
      iconName: 'BiSolidMagicWand',
      onClick: () => {
        if (aiBuilderType === 'ai-form' || aiBuilderType === 'all') {
          setCreateMode('ai-form')
          setSkipModeSelection(true)
          onCreate()
        } else {
          navigate(`${URLS.EDITOR}/ai`)
        }
      },
    },
    {
      header: 'Use a template',
      description:
        'Select from pre-built workflows that you can use as-is or customize further for your own use case',
      iconName: 'BiBookOpen',
      onClick: () => navigate(URLS.TEMPLATES),
    },
    {
      header: 'Start from scratch',
      description: 'Use our workflow builder to create your own workflow',
      iconName: 'BiPlus',
      onClick: () => {
        // when creating a new flow from the empty flows page
        // skip the mode selection in the modal
        // and directly open the modal with flow name input
        // and show the use case suggestions
        setCreateMode('new')
        setSkipModeSelection(true)
        onCreate()
      },
    },
  ].filter(Boolean) as TileProps[]

  return (
    <Flex
      maxW="800px"
      margin="auto"
      rowGap={4}
      flexDir="column"
      pt={{ base: '0', md: '10vh' }}
    >
      <Flex maxW="800px">
        <Text textStyle="h3">How do you want to create your pipe?</Text>
      </Flex>

      <Flex gap={4} flexDir={{ base: 'column', md: 'row' }}>
        {TILES.map((tile) => (
          <CreatePipeTile key={tile.header} {...tile} />
        ))}
      </Flex>
    </Flex>
  )
}
