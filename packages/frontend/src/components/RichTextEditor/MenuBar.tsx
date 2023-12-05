import './MenuBar.scss'

import { useCallback, useState } from 'react'
import { LuHeading1, LuHeading2, LuHeading3, LuHeading4 } from 'react-icons/lu'
import {
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiBold,
  RiDeleteColumn,
  RiDeleteRow,
  RiFormatClear,
  RiImageFill,
  RiInsertColumnRight,
  RiInsertRowBottom,
  RiItalic,
  RiLink,
  RiLinkUnlink,
  RiListOrdered,
  RiListUnordered,
  RiTableLine,
  RiUnderline,
} from 'react-icons/ri'
import { LoadingButton } from '@mui/lab'
import {
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material'
import { Editor } from '@tiptap/react'
import Form from 'components/Form'
import { parse } from 'node-html-parser'

import { BareEditor } from '.'

const menuButtons = [
  {
    label: 'Bold',
    onClick: (editor: Editor) => editor.chain().focus().toggleBold().run(),
    icon: <RiBold />,
    isActive: (editor: Editor) => editor.isActive('bold'),
  },
  {
    label: 'Italic',
    onClick: (editor: Editor) => editor.chain().focus().toggleItalic().run(),
    icon: <RiItalic />,
    isActive: (editor: Editor) => editor.isActive('italic'),
  },
  {
    label: 'Underline',
    icon: <RiUnderline />,
    onClick: (editor: Editor) => editor.chain().focus().toggleUnderline().run(),
    isActive: (editor: Editor) => editor.isActive('underline'),
  },
  {
    label: 'divider',
  },
  {
    label: 'Set link',
    icon: <RiLink />,
    onClick: (editor: Editor) => {
      const previousUrl = editor.getAttributes('link').href
      const url = window.prompt('URL', previousUrl)

      // cancelled
      if (url === null) {
        return
      }

      // empty
      if (url === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run()

        return
      }

      // update link
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: url })
        .run()
    },
  },
  {
    label: 'Remove link',
    icon: <RiLinkUnlink />,
    onClick: (editor: Editor) => editor.chain().focus().unsetLink().run(),
  },
  {
    label: 'divider',
  },
  {
    label: 'Heading 1',
    icon: <LuHeading1 />,
    onClick: (editor: Editor) =>
      editor.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (editor: Editor) => editor.isActive('heading', { level: 1 }),
  },
  {
    label: 'Heading 2',
    icon: <LuHeading2 />,
    onClick: (editor: Editor) =>
      editor.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (editor: Editor) => editor.isActive('heading', { level: 2 }),
  },
  {
    label: 'Heading 3',
    icon: <LuHeading3 />,
    onClick: (editor: Editor) =>
      editor.chain().focus().toggleHeading({ level: 3 }).run(),
    isActive: (editor: Editor) => editor.isActive('heading', { level: 3 }),
  },
  {
    label: 'Heading 4',
    icon: <LuHeading4 />,
    onClick: (editor: Editor) =>
      editor.chain().focus().toggleHeading({ level: 4 }).run(),
    isActive: (editor: Editor) => editor.isActive('heading', { level: 4 }),
  },
  {
    label: 'Bullet List',
    icon: <RiListUnordered />,
    onClick: (editor: Editor) =>
      editor.chain().focus().toggleBulletList().run(),
    isActive: (editor: Editor) => editor.isActive('bulletList'),
  },
  {
    label: 'Ordered List',
    icon: <RiListOrdered />,
    onClick: (editor: Editor) =>
      editor.chain().focus().toggleOrderedList().run(),
    isActive: (editor: Editor) => editor.isActive('orderedList'),
  },
  {
    label: 'Add Image',
    icon: <RiImageFill />,
    onClick: (editor: Editor) => {
      const url = window.prompt('URL')
      if (url === null) {
        return
      }
      editor.chain().focus().setImage({ src: url }).run()
    },
  },
  {
    label: 'divider',
  },
  {
    label: 'Add Table',
    icon: <RiTableLine />,
    onClick: (editor: Editor) =>
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: false })
        .run(),
  },
  {
    label: 'Add column',
    icon: <RiInsertColumnRight />,
    onClick: (editor: Editor) => editor.chain().focus().addColumnAfter().run(),
  },
  {
    label: 'Remove column',
    icon: <RiDeleteColumn />,
    onClick: (editor: Editor) => editor.chain().focus().deleteColumn().run(),
  },
  {
    label: 'Add row',
    icon: <RiInsertRowBottom />,
    onClick: (editor: Editor) => editor.chain().focus().addRowAfter().run(),
  },
  {
    label: 'Remove row',
    icon: <RiDeleteRow />,
    onClick: (editor: Editor) => editor.chain().focus().deleteRow().run(),
  },
  {
    label: 'divider',
  },
  {
    label: 'Clear Format',
    icon: <RiFormatClear />,
    onClick: (editor: Editor) =>
      editor.chain().focus().clearNodes().unsetAllMarks().run(),
  },
  {
    label: 'Undo',
    icon: <RiArrowGoBackLine />,
    onClick: (editor: Editor) => editor.chain().focus().undo().run(),
  },
  {
    label: 'Redo',
    icon: <RiArrowGoForwardLine />,
    onClick: (editor: Editor) => editor.chain().focus().redo().run(),
  },
]

interface MenuBarProps {
  editor: Editor | null
}
export const MenuBar = ({ editor }: MenuBarProps) => {
  const [showValueDialog, setShowValueDialog] = useState(false)
  const [dialogValue, setDialogValue] = useState('')
  const [dialogLabel, setDialogLabel] = useState('')
  const onClickOverrides: { [key: string]: () => void } = {
    ['Set link']: useCallback(() => {
      if (!editor) {
        return
      }
      const previousUrl = editor.getAttributes('link').href
      setDialogLabel('Set link')
      setDialogValue(previousUrl)
      setShowValueDialog(true)
    }, [editor]),
    ['Add Image']: useCallback(() => {
      if (!editor) {
        return
      }
      setDialogLabel('Add Image')
      setDialogValue('')
      setShowValueDialog(true)
    }, [editor]),
  }
  const dialogOnSubmits: { [key: string]: () => void } = {
    ['Set link']: useCallback(() => {
      if (!editor) {
        return
      }
      const url = dialogValue
      // cancelled
      if (url === null) {
        return
      }

      // empty
      if (url === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run()

        return
      }

      // update link
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: url })
        .run()
      setShowValueDialog(false)
    }, [editor, dialogValue, setShowValueDialog]),
    ['Add Image']: useCallback(() => {
      if (!editor) {
        return
      }
      const url = dialogValue
      if (url === null) {
        return
      }
      editor.chain().focus().setImage({ src: url }).run()
      setShowValueDialog(false)
    }, [editor, dialogValue]),
  }
  const dialogPlaceholders: { [key: string]: string } = {
    ['Set link']: 'Enter a full URL with http prefix',
    ['Add Image']:
      'Enter direct image link (e.g. https://file.go.gov.sg/clipplumer.png)',
  }
  if (!editor) {
    return null
  }

  return (
    <>
      <div className="editor__header">
        {menuButtons.map(({ onClick, label, icon, isActive }, index) => {
          if (!onClick) {
            return <div className="divider" key={`${label}${index}`} />
          }
          return (
            <button
              key={`${label}${index}`}
              title={label}
              style={{
                borderRadius: '0.25rem',
                width: 'auto',
                minWidth: 0,
                backgroundColor: isActive?.(editor)
                  ? 'rgba(0,0,0,0.1)'
                  : 'transparent',
              }}
              className={`menu-item${isActive?.(editor) ? ' is-active' : ''}`}
              onClick={() => {
                if (onClickOverrides && onClickOverrides[label]) {
                  onClickOverrides[label]()
                  return
                }
                onClick(editor)
              }}
            >
              {icon}
            </button>
          )
        })}
      </div>
      <Dialog
        open={showValueDialog}
        onClose={() => setShowValueDialog(false)}
        PaperProps={{
          // so that the variable selector float can overlay
          sx: { display: 'inline-table' },
        }}
      >
        <DialogTitle>{dialogLabel}</DialogTitle>
        <DialogContent>
          <DialogContentText
            tabIndex={-1}
            component="div"
            className="menubar-dialog-content"
          >
            <Form onSubmit={() => dialogOnSubmits[dialogLabel]()}>
              <BareEditor
                // val is in HTML, need to parse back to plain text
                onChange={(val) => setDialogValue(parse(val).textContent)}
                initialValue={dialogValue}
                editable
                variablesEnabled
                placeholder={dialogPlaceholders[dialogLabel]}
              />
              <LoadingButton
                type="submit"
                variant="contained"
                color="primary"
                sx={{ boxShadow: 2 }}
              >
                Submit
              </LoadingButton>
            </Form>
          </DialogContentText>
        </DialogContent>
      </Dialog>
    </>
  )
}
