import { useMemo } from 'react'
import { MdCheck, MdContentCopy } from 'react-icons/md'
import {
  Box,
  Code,
  IconButton,
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
  useClipboard,
} from '@chakra-ui/react'
import { Streamdown } from 'streamdown'

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') {
    return node
  }
  if (typeof node === 'number') {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join('')
  }
  if (node !== null && typeof node === 'object' && 'props' in node) {
    return extractText((node as React.ReactElement).props.children)
  }
  return ''
}

function CodeBlock(props: React.ComponentProps<'pre'>) {
  const { onCopy, hasCopied } = useClipboard(extractText(props.children))

  return (
    <Box position="relative" my={4} width="100%">
      <IconButton
        aria-label="Copy code"
        icon={hasCopied ? <MdCheck /> : <MdContentCopy />}
        size="xs"
        variant="clear"
        colorScheme="gray"
        position="absolute"
        top={2}
        right={2}
        onClick={onCopy}
        zIndex={1}
      />
      <Box
        as="pre"
        p={4}
        pr={10}
        bg="gray.100"
        borderRadius="md"
        overflowX="auto"
        fontSize="sm"
        whiteSpace="pre-wrap"
        {...props}
      />
    </Box>
  )
}

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
        <Text textStyle="h" fontWeight={600} my={2} {...props} />
      ),
      h2: (props: React.ComponentProps<typeof Text>) => (
        <Text textStyle="h5" mt={4} mb={2} {...props} />
      ),
      h3: (props: React.ComponentProps<typeof Text>) => (
        <Text textStyle="h6" fontWeight={600} mt={4} mb={2} {...props} />
      ),
      h4: (props: React.ComponentProps<typeof Text>) => (
        <Text textStyle="subhead-1" fontWeight={600} mt={4} mb={4} {...props} />
      ),
      h5: (props: React.ComponentProps<typeof Text>) => (
        <Text textStyle="subhead-2" mt={4} mb={4} {...props} />
      ),
      h6: (props: React.ComponentProps<typeof Text>) => (
        <Text textStyle="caption-1" mt={4} mb={2} {...props} />
      ),
      p: (props: React.ComponentProps<typeof Text>) => (
        <Text mb={4} lineHeight={1.6} {...props} />
      ),
      strong: (props: React.ComponentProps<'strong'>) => (
        <Box
          as="strong"
          fontWeight="semibold"
          display="inline"
          my={4}
          {...props}
        />
      ),
      code: (props: React.ComponentProps<typeof Code>) => (
        <Code colorScheme="gray" {...props} />
      ),
      a: (props: React.ComponentProps<typeof Link>) => (
        <Link color="blue.500" {...props} />
      ),
      ul: (props: React.ComponentProps<typeof List>) => (
        <List styleType="disc" spacing={2} pl={4} m={4} {...props} />
      ),
      ol: (props: React.ComponentProps<typeof List>) => (
        <List
          as="ol"
          styleType="decimal"
          spacing={2}
          pl={4}
          m={2}
          sx={{ 'li > ol': { listStyleType: 'lower-alpha' } }}
          {...props}
        />
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
      pre: (props: React.ComponentProps<'pre'>) => <CodeBlock {...props} />,
    }),
    [],
  )

  return (
    <Streamdown isAnimating={isAnimating} components={components}>
      {children}
    </Streamdown>
  )
}
