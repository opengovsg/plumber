import { useMemo } from 'react'
import { chakra } from '@chakra-ui/react'
import fuzzysort from 'fuzzysort'

interface HighlightedTextProps {
  searchQuery: string
  textToHighlight: string
}

export const HighlightedText = ({
  searchQuery,
  textToHighlight,
}: HighlightedTextProps) => {
  const highlighted = useMemo(() => {
    if (!searchQuery) {
      return textToHighlight
    }
    const result = fuzzysort.single(searchQuery, textToHighlight)
    // Return the original text if no match is found.
    if (!result) {
      return textToHighlight
    }
    return fuzzysort.highlight(result, (match, i) => (
      <chakra.mark key={i} bg="primary.100" borderRadius="sm">
        {match}
      </chakra.mark>
    ))
  }, [searchQuery, textToHighlight])

  return <chakra.span>{highlighted}</chakra.span>
}
