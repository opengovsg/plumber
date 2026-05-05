import { mergeAttributes, Node } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { TableVariablePill } from './TableVariablePill'

export type TableVariableOptions = {
  HTMLAttributes: Record<string, unknown>
}

const key = 'tableVariable'
export const TableVariablePluginKey = new PluginKey(key)

/**
 * TipTap extension for rendering table variables with column selection
 *
 * Table variables have an ID format like:
 * step.uuid.path|hexEncodedModifier
 *
 * Where the hex-encoded modifier decodes to "table:col1,col2,col3"
 */
export const TableVariable = Node.create<TableVariableOptions>({
  name: key,
  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },
  group: 'inline',
  inline: true,
  selectable: true,
  atom: true,
  addAttributes() {
    return {
      // id contains the full variable path with hex modifier
      // e.g., "step.uuid.data|7461626c653a636f6c312c636f6c32"
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-id'),
        renderHTML: (attrs) => {
          if (!attrs.id) {
            return {}
          }
          return {
            'data-id': attrs.id,
          }
        },
      },
    }
  },
  parseHTML() {
    return [
      {
        tag: `span[data-type="${this.name}"]`,
      },
    ]
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes({ 'data-type': this.name }, this.options.HTMLAttributes, {
        'data-id': HTMLAttributes['data-id'],
      }),
      // The stored value in HTML is the variable placeholder
      `{{${node.attrs.id}}}`,
    ]
  },
  renderText({ node }) {
    return `{{${node.attrs.id}}}`
  },
  addNodeView() {
    return ReactNodeViewRenderer(TableVariablePill, {
      attrs: {
        style: 'display: block; margin: 4px 0;',
      },
    })
  },
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { selection } = editor.state
        const { $head } = selection

        if (
          $head.nodeAfter?.type.name === this.name &&
          $head.pos > 0 &&
          $head.parentOffset > 0
        ) {
          editor.commands.deleteRange({ from: $head.pos - 1, to: $head.pos })
          return true
        }

        return false
      },
      Delete: ({ editor }) => {
        const { selection } = editor.state
        const { $head } = selection

        const nextNode = $head.nodeAfter

        if (nextNode?.isText && nextNode.text && nextNode.text.length > 0) {
          editor.commands.deleteRange({ from: $head.pos, to: $head.pos + 1 })
          return true
        }

        if (nextNode?.type.name === this.name) {
          const nodeSize = nextNode.nodeSize
          editor.commands.deleteRange({
            from: $head.pos,
            to: $head.pos + nodeSize,
          })
          return true
        }

        return false
      },
    }
  },
})
