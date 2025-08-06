import { Flex, Heading } from '@chakra-ui/react'

interface ContentBoxProps {
  headerText: string
  children: React.ReactNode
}

/**
 * Each content box is a section of the use case page
 * You can put text, quote or illustraation (image) in any order you want as a customisation
 */
export default function ContentBox(props: ContentBoxProps) {
  const { headerText, children } = props
  return (
    <Flex maxW="2xl" gap={8} flexDir="column">
      <Heading
        as="h2"
        fontSize="3xl"
        fontWeight="500"
        color="gray.900"
        lineHeight="normal"
        letterSpacing="tighter"
      >
        {headerText}
      </Heading>
      {children}
    </Flex>
  )
}
