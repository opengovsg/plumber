import { useMemo } from 'react'
import { BiLinkExternal } from 'react-icons/bi'
import ReactMarkdown, { Components } from 'react-markdown'
import {
  Box,
  forwardRef,
  Icon,
  Link,
  LinkProps,
  ListItem,
  OrderedList,
  Text,
  UnorderedList,
} from '@chakra-ui/react'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
  /**
   * Whether to allow sequential new lines to generate sequential line breaks.
   * Breaks markdown specs, but allows for WYSIWYG text editing.
   * @defaultValues `false`
   */
  allowMultilineBreaks?: boolean
  source: string
  components?: Components
}

export default function MarkdownRenderer(props: MarkdownRendererProps) {
  const { allowMultilineBreaks = true, source, components = {} } = props
  const processedSource = useMemo(() => {
    if (allowMultilineBreaks) {
      return source.replace(/\n/gi, '&nbsp; \n')
    }
    return source
  }, [source, allowMultilineBreaks])

  // Define Markdown styles using Chakra UI components
  const textStyles = {
    sx: {
      lineHeight: '1.5',
      color: 'secondary.500',
      textStyle: 'body-1',
      fontSize: '1rem',
    },
  }

  const linkStyles = {
    sx: {
      fontSize: '1rem',
    },
  }

  const listStyles = {
    sx: {
      color: 'secondary.500',
      marginInlineStart: '1.25em',
    },
  }

  const ExternalIcon = (): JSX.Element => {
    return <Icon as={BiLinkExternal} verticalAlign="middle" ml="0.25rem" />
  }

  // differentiates between an internal and external link when displaying
  const CustomLink = forwardRef<LinkProps, 'a'>(
    ({ children: content, isExternal, ...props }, ref) => {
      return (
        <Link ref={ref} {...props} isExternal={isExternal}>
          {content}
          {isExternal && <ExternalIcon />}
        </Link>
      )
    },
  )

  const mdComponents: Components = {
    p: ({ ...props }) => <Text {...props} {...textStyles} />,
    ol: ({ ordered, ...props }) => {
      const newProps = { ordered: ordered.toString(), ...props }
      return <OrderedList {...newProps} {...listStyles} />
    },
    ul: ({ ordered, ...props }) => {
      const newProps = { ordered: ordered.toString(), ...props }
      return <UnorderedList {...newProps} {...listStyles} />
    },
    li: ({ ordered, ...props }) => {
      const newProps = { ordered: ordered.toString(), ...props }
      return <ListItem {...newProps} {...textStyles} />
    },
    a: ({ ...props }) => {
      const { href } = props
      // used for relative URL by setting the dynamic base URL
      const base = new URL(
        `${window.location.protocol}//${window.location.host}`,
      )
      const isExternal =
        (href && new URL(href, base).hostname !== base.hostname) || false
      return (
        <CustomLink
          isExternal={isExternal}
          {...props}
          {...linkStyles}
        ></CustomLink>
      )
    },
  }

  return (
    <Box>
      <ReactMarkdown
        components={{
          ...mdComponents,
          ...components,
        }}
        remarkPlugins={[remarkBreaks, remarkGfm]}
      >
        {processedSource}
      </ReactMarkdown>
    </Box>
  )
}
