import { Box } from '@chakra-ui/react'

import { BareEditor } from '@/components/RichTextEditor'

interface RichTextPreviewProps {
  html: string
}

// Renders resolved rich-text HTML (e.g. a Pair prompt or an email body)
// inline and read-only via the same Tiptap renderer the editor uses, so tags
// like tables render as they would when the flow runs.
export default function RichTextPreview({ html }: RichTextPreviewProps) {
  return (
    <Box
      w="full"
      maxH="300px"
      overflowY="auto"
      // Strip the editable-textarea chrome (border, focus ring, min-height)
      // and match the plain-text rows' font so this reads as display text.
      sx={{
        '.editor': {
          border: 'none',
          backgroundColor: 'transparent',
          height: 'auto',
        },
        '.editor:focus-within': {
          border: 'none',
          boxShadow: 'none',
        },
        // isDisplayOnly forces a fixed 60vh height + its own scrollbar
        // inline — override both so only our maxH Box scrolls.
        '.editor__content': {
          height: 'auto !important',
          overflow: 'visible !important',
        },
        '.editor__content .ProseMirror': {
          padding: 0,
          minHeight: 'auto',
          maxHeight: 'none',
          fontSize: 'sm',
          lineHeight: '1.6',
          color: 'base.content.default',
        },
      }}
    >
      <BareEditor
        onChange={() => {
          // Read-only: no edits to persist.
        }}
        initialValue={html}
        editable={false}
        isRich
        isDisplayOnly
      />
    </Box>
  )
}
