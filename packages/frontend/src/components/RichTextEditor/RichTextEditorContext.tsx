import { createContext } from 'react'

interface RichTextEditorContextValue {
  closeSuggestions: () => void
  openSuggestions: () => void
  supportTableDisplay?: boolean
  // Overrides the step name shown in a variable badge's tooltip, for
  // contexts without the full EditorContext's `stepsWithVars`.
  getVariableStepName?: (variableId: string) => string | undefined
}

export const RichTextEditorContext = createContext<RichTextEditorContextValue>({
  closeSuggestions: () => {},
  openSuggestions: () => {},
  supportTableDisplay: false,
})
