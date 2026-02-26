import { Code, Link, List, ListItem, Text } from '@chakra-ui/react'
import { Streamdown } from 'streamdown'

interface ChakraStreamdownProps {
  children: string
  isAnimating?: boolean
}

export function ChakraStreamdown({
  children,
  isAnimating = false,
}: ChakraStreamdownProps) {
  return (
    <Streamdown
      isAnimating={isAnimating}
      components={{
        h1: (props) => <Text textStyle="h1" {...props} />,
        h2: (props) => <Text textStyle="h2" mb={2} {...props} />,
        h3: (props) => <Text textStyle="h3" mt={2} mb={2} {...props} />,
        h4: (props) => <Text textStyle="h4" mt={2} mb={2} {...props} />,
        h5: (props) => <Text textStyle="h5" mt={2} mb={2} {...props} />,
        h6: (props) => <Text textStyle="h6" mt={2} mb={2} {...props} />,
        p: (props) => <Text {...props} />,
        code: (props) => <Code colorScheme="gray" {...props} />,
        a: (props) => <Link color="blue.500" {...props} />,
        ul: (props) => <List styleType="disc" spacing={2} pl={4} {...props} />,
        ol: (props) => (
          <List as="ol" styleType="decimal" spacing={2} pl={4} {...props} />
        ),
        li: (props) => <ListItem {...props} />,
      }}
    >
      {children}
    </Streamdown>
  )
}
