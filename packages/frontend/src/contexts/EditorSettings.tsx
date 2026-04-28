import { type IFlow } from '@plumber/types'

import { createContext, ReactElement } from 'react'

interface IEditorSettingsContext {
  flow: IFlow
  hasEditPermission: boolean
  hasCollaborators: boolean
}

export const EditorSettingsContext = createContext<IEditorSettingsContext>({
  flow: {} as IFlow,
  hasEditPermission: false,
  hasCollaborators: false,
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
  const hasCollaborators = !!flow?.collaborators?.some(
    (c) => c?.role !== 'owner',
  )

  return (
    <EditorSettingsContext.Provider
      value={{ flow, hasEditPermission, hasCollaborators }}
    >
      {children}
    </EditorSettingsContext.Provider>
  )
}
