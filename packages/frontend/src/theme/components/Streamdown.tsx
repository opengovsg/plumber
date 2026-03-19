import { useMemo } from 'react'
import {
  Code,
  Link,
  List,
  ListItem,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import { Streamdown } from 'streamdown'

interface ChakraStreamdownProps {
  children: string
  isAnimating?: boolean
}

export function ChakraStreamdown({
  children,
  isAnimating = false,
}: ChakraStreamdownProps) {
  // Memoize components to prevent unnecessary re-renders during streaming
  const components = useMemo(
    () => ({
      h1: (props: React.ComponentProps<typeof Text>) => (
        <Text textStyle="h1" {...props} />
      ),
      h2: (props: React.ComponentProps<typeof Text>) => (
        <Text textStyle="h2" mb={2} {...props} />
      ),
      h3: (props: React.ComponentProps<typeof Text>) => (
        <Text textStyle="h3" mt={2} mb={2} {...props} />
      ),
      h4: (props: React.ComponentProps<typeof Text>) => (
        <Text textStyle="h4" mt={2} mb={2} {...props} />
      ),
      h5: (props: React.ComponentProps<typeof Text>) => (
        <Text textStyle="h5" mt={2} mb={2} {...props} />
      ),
      h6: (props: React.ComponentProps<typeof Text>) => (
        <Text textStyle="h6" mt={2} mb={2} {...props} />
      ),
      p: (props: React.ComponentProps<typeof Text>) => <Text {...props} />,
      code: (props: React.ComponentProps<typeof Code>) => (
        <Code colorScheme="gray" {...props} />
      ),
      a: (props: React.ComponentProps<typeof Link>) => (
        <Link color="blue.500" {...props} />
      ),
      ul: (props: React.ComponentProps<typeof List>) => (
        <List styleType="disc" spacing={2} pl={4} {...props} />
      ),
      ol: (props: React.ComponentProps<typeof List>) => (
        <List as="ol" styleType="decimal" spacing={2} pl={4} {...props} />
      ),
      li: (props: React.ComponentProps<typeof ListItem>) => (
        <ListItem {...props} />
      ),
      table: (props: React.ComponentProps<typeof Table>) => (
        <Table variant="simple" size="sm" mb={4} {...props} />
      ),
      thead: (props: React.ComponentProps<typeof Thead>) => (
        <Thead {...props} />
      ),
      tbody: (props: React.ComponentProps<typeof Tbody>) => (
        <Tbody {...props} />
      ),
      tr: (props: React.ComponentProps<typeof Tr>) => <Tr {...props} />,
      th: (props: React.ComponentProps<typeof Th>) => <Th {...props} />,
      td: (props: React.ComponentProps<typeof Td>) => <Td {...props} />,
    }),
    [],
  )

  return (
    <Streamdown isAnimating={isAnimating} components={components}>
      {children}
    </Streamdown>
  )
}
