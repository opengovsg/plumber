import { Flex, Tooltip } from '@chakra-ui/react'
import { Button, IconButton } from '@opengovsg/design-system-react'
import { BiPlus, BiSolidMagicWand } from 'react-icons/bi'
import { useNavigate } from 'react-router-dom'

import * as URLS from '@/config/urls'

interface CreatePipeButtonProps {
  onOpen: () => void
}

export default function CreatePipeButton(props: CreatePipeButtonProps) {
  const { onOpen } = props

  const navigate = useNavigate()

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
