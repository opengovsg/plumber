import { Box } from '@chakra-ui/react'

import { SUPPORT_FORM_LINK } from '@/config/urls'

export default function SupportContactMessage() {
  return (
    <Box
      marginTop={4}
      borderTop="1px solid #E0E0E0"
      fontSize="0.8rem"
      opacity={0.8}
      w="full"
    >
      If this error still persists, contact{' '}
      <a href={SUPPORT_FORM_LINK} target="_blank" rel="noreferrer">
        Plumber support
      </a>
      .
    </Box>
  )
}
