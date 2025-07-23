import { Box } from '@chakra-ui/react'

import Container from '@/components/Container'

interface ContentSectionProps {
  contentBoxes: React.ReactNode
}

export default function ContentSection(props: ContentSectionProps) {
  const { contentBoxes } = props

  return (
    <Box bg="white" pb={16}>
      <Container
        maxW="3xl"
        color="gray.700"
        fontSize="md"
        lineHeight="7"
        display="flex"
        flexDirection="column"
        gap={16}
      >
        {contentBoxes}
      </Container>
    </Box>
  )
}
