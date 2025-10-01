import { type IFlow } from '@plumber/types'

import { createContext, ReactElement } from 'react'

interface IEditorSettingsContext {
  flow: IFlow
  hasEditPermission: boolean
}

export const EditorSettingsContext = createContext<IEditorSettingsContext>({
  flow: {} as IFlow,
  hasEditPermission: false,
} as IEditorSettingsContext)

type EditorSettingsProviderProps = {
  children: React.ReactNode
  flow: IFlow
}

export const EditorSettingsProvider = (
  props: EditorSettingsProviderProps,
): ReactElement => {
  const { children, flow } = props
  const hasEditPermission = flow.role === 'owner' || flow.role === 'editor'

  return (
    <EditorSettingsContext.Provider value={{ flow, hasEditPermission }}>
      {children}
    </EditorSettingsContext.Provider>
  )
}
