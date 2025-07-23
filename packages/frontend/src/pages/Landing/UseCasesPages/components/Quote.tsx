import { Box, HStack, Text } from '@chakra-ui/react'

interface QuoteProps {
  quote: string
  author: string
  authorTitle: string
}

export default function Quote(props: QuoteProps) {
  const { quote, author, authorTitle } = props
  return (
    <Box as="figure" borderLeft="4px" borderColor="primary.500" pl={9}>
      <Box as="blockquote" fontWeight="400" color="gray.900">
        <Text>{quote}</Text>
      </Box>

      <HStack mt={6} spacing={4}>
        <Box fontSize="sm" lineHeight={6}>
          <Text as="span" fontWeight="semibold" color="gray.900">
            {author}
          </Text>
          <Text as="span" color="gray.600">
            {' '}
            – {authorTitle}
          </Text>
        </Box>
      </HStack>
    </Box>
  )
}
