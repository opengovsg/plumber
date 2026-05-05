import { createContext } from 'react'

interface RichTextEditorContextValue {
  closeSuggestions: () => void
  openSuggestions: () => void
  supportTableDisplay?: boolean
}

export const RichTextEditorContext = createContext<RichTextEditorContextValue>({
  closeSuggestions: () => {},
  openSuggestions: () => {},
  supportTableDisplay: false,
})
