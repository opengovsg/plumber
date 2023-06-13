import {
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
} from '@chakra-ui/react'
import { QuestionMark } from '@mui/icons-material'
import { IconButton, Link } from '@opengovsg/design-system-react'
import * as URLS from 'config/urls'

export const GuideFab = () => {
  return (
    <Popover trigger="hover">
      <PopoverTrigger>
        <IconButton
          aria-label="Guide"
          position="fixed"
          boxShadow="base"
          bottom={6}
          right={6}
          bg="white"
          _hover={{
            bg: 'secondary.50',
          }}
          variant="outline"
          colorScheme="secondary"
          icon={<QuestionMark />}
          as={Link}
          href={URLS.GUIDE_LINK}
          target="_blank"
        />
      </PopoverTrigger>
      <PopoverContent w="fit-content" bg="secondary.800" color="white">
        <PopoverArrow bg="secondary.800" />
        <PopoverBody>User Guide</PopoverBody>
      </PopoverContent>
    </Popover>
  )
}
