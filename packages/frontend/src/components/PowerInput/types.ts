import type { BaseEditor, Descendant, Text } from 'slate'
import type { ReactEditor } from 'slate-react'

export type VariableElement = {
  type: 'variable'
  value?: unknown

  /**
   * CAVEAT: not _just_ a name; it contains the lodash.get path for dataOut. Do
   * not clobber unles you know what you're doing!
   */
  name?: string

  children: Text[]
  label?: string
}

export type ParagraphElement = {
  type: 'paragraph'
  children: Descendant[]
}

export type CustomEditor = BaseEditor & ReactEditor

export type CustomElement = VariableElement | ParagraphElement

declare module 'slate' {
  interface CustomTypes {
    Editor: CustomEditor
    Element: CustomElement
  }
}
