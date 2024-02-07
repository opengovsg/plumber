import { mergeAttributes, Node } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { VariableBadge } from './VariableBadge'

export type VariableOptions = {
  HTMLAttributes: Record<string, any>
}
const key = 'variable'
export const VariablePluginKey = new PluginKey(key)

export const StepVariable = Node.create<VariableOptions>({
  name: key,
  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },
  group: 'inline',
  inline: true,
  selectable: false,
  atom: true,
  addAttributes() {
    // attributes equivalent of
    // id: step name
    // label: step label
    // value: step test value
    // these are only used for NodeView purpose
    // we technically don't need to render them into the final HTML value, however
    // they need to be rendered there for rich text editor to be able to resume
    // where user left off. The resulting content render won't be affected by
    // these data- attributes
    return {
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
      label: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-label'),
        renderHTML: (attrs) => {
          if (!attrs.label) {
            return {}
          }

          return {
            'data-label': attrs.label,
          }
        },
      },
      value: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-value'),
        renderHTML: (attrs) => {
          if (!attrs.value) {
            return {}
          }

          return {
            'data-value': attrs.value,
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
      mergeAttributes(
        { 'data-type': this.name },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      `{{${node.attrs.id}}}`,
    ]
  },
  renderText({ node }) {
    return `{{${node.attrs.id}}}`
  },
  addNodeView() {
    return ReactNodeViewRenderer(VariableBadge, {
      attrs: {
        style: 'display: inline-block;',
      },
    })
  },
})
