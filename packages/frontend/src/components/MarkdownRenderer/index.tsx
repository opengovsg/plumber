import { useMemo } from 'react'
import ReactMarkdown, { Components } from 'react-markdown'
import { Box } from '@chakra-ui/react'
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
  const { allowMultilineBreaks = false, source, components } = props
  const processedSource = useMemo(() => {
    if (allowMultilineBreaks) {
      return source.replace(/\n/gi, '&nbsp; \n')
    }
    return source
  }, [source, allowMultilineBreaks])

  return (
    <Box>
      <ReactMarkdown
        components={components}
        remarkPlugins={[remarkBreaks, remarkGfm]}
      >
        {processedSource}
      </ReactMarkdown>
    </Box>
  )
}
