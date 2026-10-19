import { useContext } from 'react'
import { BiPlus, BiSolidMagicWand } from 'react-icons/bi'
import { useNavigate } from 'react-router-dom'
import { Flex, Tooltip } from '@chakra-ui/react'
import { Button, IconButton } from '@opengovsg/design-system-react'

import { AI_BUILDER_FEATURE_FLAG } from '@/config/flags'
import * as URLS from '@/config/urls'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'

interface CreatePipeButtonProps {
  onOpen: () => void
}

export default function CreatePipeButton(props: CreatePipeButtonProps) {
  const { onOpen } = props

  const navigate = useNavigate()

  // TODO (kevinkim-ogp): remove the flag value once GA
  const { getFlagValue } = useContext(LaunchDarklyContext)
  const aiBuilderFlag = getFlagValue(AI_BUILDER_FEATURE_FLAG, {
    enabled: false,
  })
  const canUseAiBuilder = aiBuilderFlag.enabled

  if (canUseAiBuilder) {
    return (
      <Flex gap={1}>
        <Button
          leftIcon={<BiSolidMagicWand />}
          onClick={() => navigate(`${URLS.EDITOR}/ai`)}
        >
          Create with AI
        </Button>
        <Tooltip label="Create pipe" hasArrow>
          <IconButton
            data-test="create-flow-button"
            aria-label="Create pipe"
            icon={<BiPlus />}
            onClick={onOpen}
            bgColor="primary.100"
            color="primary.500"
            borderColor="transparent"
            _hover={{ bgColor: 'primary.200' }}
            _active={{ bgColor: 'primary.200' }}
          />
        </Tooltip>
      </Flex>
    )
  }

  return (
    <Button data-test="create-flow-button" onClick={onOpen}>
      Create Pipe
    </Button>
  )
}
