import { Box } from '@chakra-ui/react'

import { BareEditor } from '@/components/RichTextEditor'

interface RichTextPreviewProps {
  html: string
  stepNameById: Map<string, string>
}

const ALLOWED_HREF_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:']

// Parses via DOMParser rather than regex: attribute values it returns are
// already unquoted and HTML-entity-decoded, so a scheme like javascript:
// can't hide behind missing quotes or an `&colon;` encoding.
function sanitizeRichTextHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href') ?? ''
    const trimmed = href.trim()
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    const isAllowed =
      !hasScheme ||
      ALLOWED_HREF_PROTOCOLS.some((protocol) =>
        trimmed.toLowerCase().startsWith(protocol),
      )
    if (!isAllowed) {
      anchor.setAttribute('href', '#')
    }
  })
  return doc.body.innerHTML
}

// A variable's `id` is `step.<stepId>.<path>`; look up by the bare step id.
function getVariableStepName(
  variableId: string,
  stepNameById: Map<string, string>,
): string | undefined {
  if (!variableId.startsWith('step.')) {
    return undefined
  }
  return stepNameById.get(variableId.split('.')[1])
}

// Renders resolved rich-text HTML (e.g. a Pair prompt or an email body)
// inline and read-only via the same Tiptap renderer the editor uses, so tags
// like tables render as they would when the flow runs.
export default function RichTextPreview({
  html,
  stepNameById,
}: RichTextPreviewProps) {
  return (
    <Box
      w="full"
      // No height cap: the body renders in full and the preview panel scrolls.
      // A capped box clipped long bodies with no cue that they scrolled.
      // overflowX still scrolls, so a wide line can't spill out of the step card.
      overflowX="auto"
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
        // isDisplayOnly forces a fixed 60vh height + its own scrollbar inline.
        // Override both so the body grows to its full height instead.
        '.editor__content': {
          height: 'auto !important',
          overflow: 'visible !important',
        },
        '.editor__content .ProseMirror': {
          padding: 0,
          minHeight: 'auto',
          maxHeight: 'none',
          fontSize: 'sm',
          // Extra room so the padded variable badges don't overlap lines.
          lineHeight: '2',
          color: 'base.content.default',
        },
      }}
    >
      <BareEditor
        onChange={() => {
          // Read-only: no edits to persist.
        }}
        initialValue={sanitizeRichTextHtml(html)}
        editable={false}
        variablesEnabled={false}
        isRich
        isDisplayOnly
        getVariableStepName={(variableId) =>
          getVariableStepName(variableId, stepNameById)
        }
      />
    </Box>
  )
}
