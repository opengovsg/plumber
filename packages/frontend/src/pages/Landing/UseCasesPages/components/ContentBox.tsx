import type { Components } from 'react-markdown'
import { Flex, Heading, ListItem, Text, UnorderedList } from '@chakra-ui/react'

interface ContentBoxProps {
  headerText: string
  children: React.ReactNode
}

export const CommonMdComponents: Components = {
  p: ({ ...props }) => <Text mb={2} {...props} />,
  ul: ({ ...props }) => <UnorderedList spacing={2} {...props} />,
  li: ({ ...props }) => (
    <ListItem sx={{ marginInlineStart: '1em' }} {...props} />
  ),
}

/**
 * Each content box is a section of the use case page
 * You can put text, quote or illustraation (image) in any order you want as a customisation
 */
export default function ContentBox(props: ContentBoxProps) {
  const { headerText, children } = props
  return (
    <Flex gap={8} flexDir="column">
      <Heading
        as="h2"
        fontSize="3xl"
        fontWeight="500"
        color="gray.900"
        lineHeight="normal"
        letterSpacing="tighter"
        fontFamily="'DM Sans', sans-serif"
      >
        {headerText}
      </Heading>
      {children}
    </Flex>
  )
}
