import { useState } from 'react'
import { BiSolidMagicWand } from 'react-icons/bi'
import { useNavigate } from 'react-router-dom'
import { Box, Flex } from '@chakra-ui/react'
import { Badge, Button, IconButton } from '@opengovsg/design-system-react'

import * as URLS from '@/config/urls'

const LOCAL_STORAGE_AI_BUILDER_NEW_CLICKED = 'ai-builder-new-clicked'

interface CreatePipeButtonProps {
  onOpen: () => void
}

export default function CreatePipeButton(props: CreatePipeButtonProps) {
  const { onOpen } = props

  const navigate = useNavigate()

  const [showAiBuilderNewBadge, setShowAiBuilderNewBadge] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }
    return localStorage.getItem(LOCAL_STORAGE_AI_BUILDER_NEW_CLICKED) !== 'true'
  })

  return (
    <Flex gap={0.5}>
      <Button
        data-test="create-flow-button"
        onClick={onOpen}
        borderTopRightRadius={0}
        borderBottomRightRadius={0}
      >
        Create Pipe
      </Button>
      <Box
        position="relative"
        {...(showAiBuilderNewBadge && { mr: '1.25rem' })}
      >
        <IconButton
          aria-label="Create Pipe"
          icon={<BiSolidMagicWand />}
          onClick={() => {
            localStorage.setItem(LOCAL_STORAGE_AI_BUILDER_NEW_CLICKED, 'true')
            setShowAiBuilderNewBadge(false)
            navigate(`${URLS.EDITOR}/ai`)
          }}
          borderTopLeftRadius={0}
          borderBottomLeftRadius={0}
        />
        {showAiBuilderNewBadge && (
          <Badge
            position="absolute"
            top="0"
            right="0"
            transform="translate(50%, -50%)"
            backgroundColor="secondary.700"
            fontSize="10px"
            fontWeight={500}
            borderRadius="12px"
            pointerEvents="none"
          >
            New
          </Badge>
        )}
      </Box>
    </Flex>
  )
}
