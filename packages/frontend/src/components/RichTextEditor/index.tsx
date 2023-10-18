import './RichTextEditor.scss'

import { useEffect } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { FormControl } from '@mui/material'
import { FormLabel } from '@opengovsg/design-system-react'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

import { MenuBar } from './MenuBar'

const Editor = ({
  onChange,
  initialValue,
  editable,
  placeholder,
}: {
  onChange: (...event: any[]) => void
  initialValue: string
  editable?: boolean
  placeholder?: string
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        HTMLAttributes: { rel: null, target: '_blank' },
      }),
      Underline,
      Table.configure({
        resizable: false,
        HTMLAttributes: {
          style: 'border-collapse:collapse;',
        },
      }),
      TableRow,
      TableHeader,
      TableCell.configure({
        HTMLAttributes: {
          style: 'border:1px solid black;',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: initialValue,
    onUpdate: ({ editor }) => {
      const content = editor.getHTML()
      if (content === '<p></p>') {
        // this is when content of the editor is empty
        // set controller value to empty string instead so the required rule can
        // work properly
        onChange('')
        return
      }

      onChange(content)
    },
    editable,
  })
  useEffect(() => {
    // have to listen to editable as this element might not re-render upon
    // publish and unpublish of pipe
    editor?.setOptions({ editable })
  }, [editable])
  return (
    <div className="editor">
      <MenuBar editor={editor} />
      <EditorContent
        className="editor__content"
        editor={editor}
        placeholder="Hello world"
      />
    </div>
  )
}

const RichTextEditor = ({
  required,
  defaultValue,
  name,
  label,
  description,
  disabled,
  placeholder,
}: {
  required?: boolean
  defaultValue?: string
  name: string
  label?: string
  description?: string
  disabled?: boolean
  placeholder?: string
}) => {
  const { control } = useFormContext()
  return (
    <FormControl>
      {label && (
        <FormLabel isRequired={required} description={description}>
          {label}
        </FormLabel>
      )}
      <Controller
        rules={{ required: true }}
        name={name}
        control={control}
        defaultValue={defaultValue}
        shouldUnregister={false}
        render={({ field: { onChange, value } }) => (
          <Editor
            onChange={onChange}
            initialValue={value}
            editable={!disabled}
            placeholder={placeholder}
          />
        )}
      />
    </FormControl>
  )
}

export default RichTextEditor
