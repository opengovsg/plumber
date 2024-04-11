import { type IFlow } from '@plumber/types'

import { createContext, ReactElement } from 'react'

interface IEditorSettingsContext {
  flow: IFlow
}

export const EditorSettingsContext = createContext<IEditorSettingsContext>(
  {} as IEditorSettingsContext,
)

type EditorSettingsProviderProps = {
  children: React.ReactNode
  value: IEditorSettingsContext
}

export const EditorSettingsProvider = (
  props: EditorSettingsProviderProps,
): ReactElement => {
  const { children, value } = props
  return (
    <EditorSettingsContext.Provider value={value}>
      {children}
    </EditorSettingsContext.Provider>
  )
}
