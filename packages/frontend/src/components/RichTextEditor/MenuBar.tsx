import './MenuBar.scss'

import type { TFieldPreviewType, TRteMenuOption } from '@plumber/types'

import { useCallback, useMemo, useRef, useState } from 'react'
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
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  useDisclosure,
} from '@chakra-ui/react'
import { Button, Link } from '@opengovsg/design-system-react'
import { Editor } from '@tiptap/react'
import { parse } from 'node-html-parser'

import Form from '@/components/Form'
import { RteMenuOption } from '@/graphql/__generated__/graphql'
import { makeExternalLink } from '@/helpers/urls'

import { PreviewButton } from './PreviewButton'
import { simpleSubstitute, type VariableInfoMap } from './utils'
import { BareEditor } from '.'

const DEFAULT_MENU_BUTTONS = [
  {
    label: RteMenuOption.Bold,
    onClick: (editor: Editor) => editor.chain().focus().toggleBold().run(),
    icon: <RiBold />,
    isActive: (editor: Editor) => editor.isActive('bold'),
  },
  {
    label: RteMenuOption.Italic,
    onClick: (editor: Editor) => editor.chain().focus().toggleItalic().run(),
    icon: <RiItalic />,
    isActive: (editor: Editor) => editor.isActive('italic'),
  },
  {
    label: RteMenuOption.Underline,
    icon: <RiUnderline />,
    onClick: (editor: Editor) => editor.chain().focus().toggleUnderline().run(),
    isActive: (editor: Editor) => editor.isActive('underline'),
  },
  {
    label: RteMenuOption.Divider,
  },
  {
    label: RteMenuOption.LinkSet,
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
    label: RteMenuOption.LinkRemove,
    icon: <RiLinkUnlink />,
    onClick: (editor: Editor) => editor.chain().focus().unsetLink().run(),
  },
  {
    label: RteMenuOption.Divider,
  },
  {
    label: RteMenuOption.Heading1,
    icon: <LuHeading1 />,
    onClick: (editor: Editor) =>
      editor.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (editor: Editor) => editor.isActive('heading', { level: 1 }),
  },
  {
    label: RteMenuOption.Heading2,
    icon: <LuHeading2 />,
    onClick: (editor: Editor) =>
      editor.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (editor: Editor) => editor.isActive('heading', { level: 2 }),
  },
  {
    label: RteMenuOption.Heading3,
    icon: <LuHeading3 />,
    onClick: (editor: Editor) =>
      editor.chain().focus().toggleHeading({ level: 3 }).run(),
    isActive: (editor: Editor) => editor.isActive('heading', { level: 3 }),
  },
  {
    label: RteMenuOption.Heading4,
    icon: <LuHeading4 />,
    onClick: (editor: Editor) =>
      editor.chain().focus().toggleHeading({ level: 4 }).run(),
    isActive: (editor: Editor) => editor.isActive('heading', { level: 4 }),
  },
  {
    label: RteMenuOption.ListBullet,
    icon: <RiListUnordered />,
    onClick: (editor: Editor) =>
      editor.chain().focus().toggleBulletList().run(),
    isActive: (editor: Editor) => editor.isActive('bulletList'),
  },
  {
    label: RteMenuOption.ListOrdered,
    icon: <RiListOrdered />,
    onClick: (editor: Editor) =>
      editor.chain().focus().toggleOrderedList().run(),
    isActive: (editor: Editor) => editor.isActive('orderedList'),
  },
  {
    label: RteMenuOption.ImageAdd,
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
    label: RteMenuOption.Divider,
  },
  {
    label: RteMenuOption.TableAdd,
    icon: <RiTableLine />,
    onClick: (editor: Editor) =>
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: false })
        .run(),
  },
  {
    label: RteMenuOption.ColumnAdd,
    icon: <RiInsertColumnRight />,
    onClick: (editor: Editor) => editor.chain().focus().addColumnAfter().run(),
  },
  {
    label: RteMenuOption.ColumnRemove,
    icon: <RiDeleteColumn />,
    onClick: (editor: Editor) => editor.chain().focus().deleteColumn().run(),
  },
  {
    label: RteMenuOption.RowAdd,
    icon: <RiInsertRowBottom />,
    onClick: (editor: Editor) => editor.chain().focus().addRowAfter().run(),
  },
  {
    label: RteMenuOption.RowRemove,
    icon: <RiDeleteRow />,
    onClick: (editor: Editor) => editor.chain().focus().deleteRow().run(),
  },
  {
    label: RteMenuOption.Divider,
  },
  {
    label: RteMenuOption.FormatClear,
    icon: <RiFormatClear />,
    onClick: (editor: Editor) =>
      editor.chain().focus().clearNodes().unsetAllMarks().run(),
  },
  {
    label: RteMenuOption.Undo,
    icon: <RiArrowGoBackLine />,
    onClick: (editor: Editor) => editor.chain().focus().undo().run(),
  },
  {
    label: RteMenuOption.Redo,
    icon: <RiArrowGoForwardLine />,
    onClick: (editor: Editor) => editor.chain().focus().redo().run(),
  },
]

const FORMATTING_BUTTONS_DISABLED_FOR_TABLE_VARIABLE = new Set([
  RteMenuOption.Bold,
  RteMenuOption.Italic,
  RteMenuOption.Underline,
  RteMenuOption.LinkSet,
  RteMenuOption.LinkRemove,
  RteMenuOption.Heading1,
  RteMenuOption.Heading2,
  RteMenuOption.Heading3,
  RteMenuOption.Heading4,
  RteMenuOption.ListBullet,
  RteMenuOption.ListOrdered,
])

const dialogPlaceholders: Partial<Record<RteMenuOption, string>> = {
  [RteMenuOption.LinkSet]: 'Enter a full URL with http prefix',
  [RteMenuOption.ImageAdd]:
    'Enter direct image link (e.g. https://file.go.gov.sg/clipplumber.png)',
}

interface MenuBarProps {
  editor: Editor | null
  variableMap: VariableInfoMap
  editable: boolean
  customMenuOptions?: TRteMenuOption[]
  previewType?: TFieldPreviewType
}

export const MenuBar = ({
  editor,
  variableMap,
  editable,
  customMenuOptions,
  previewType,
}: MenuBarProps) => {
  const {
    isOpen: isDialogOpen,
    onClose,
    onOpen: onDialogOpen,
  } = useDisclosure()
  const cancelRef = useRef(null)
  const [dialogValue, setDialogValue] = useState('')
  const [dialogLabel, setDialogLabel] = useState<RteMenuOption | null>(null)

  const onDialogClose = useCallback(() => {
    setDialogLabel(null)
    setDialogValue('')
    onClose()
  }, [onClose])

  const selectionContainsTableVariable = useMemo(() => {
    if (!editor) {
      return false
    }
    const { from, to } = editor.state.selection
    let found = false
    editor.state.doc.nodesBetween(from, to, (node) => {
      if (node.type.name === 'tableVariable') {
        found = true
      }
    })
    return found
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, editor?.state.selection])

  const onClickOverrides: Partial<Record<RteMenuOption, () => void>> = useMemo(
    () => ({
      [RteMenuOption.LinkSet]: () => {
        if (!editor) {
          return
        }
        const previousUrl = editor.getAttributes('link').href
        setDialogLabel(RteMenuOption.LinkSet)
        setDialogValue(previousUrl)
        onDialogOpen()
      },
      [RteMenuOption.ImageAdd]: () => {
        if (!editor) {
          return
        }
        setDialogLabel(RteMenuOption.ImageAdd)
        setDialogValue('')
        onDialogOpen()
      },
    }),
    [editor, onDialogOpen],
  )

  const dialogOnSubmits: Partial<Record<RteMenuOption, () => void>> = useMemo(
    () => ({
      [RteMenuOption.LinkSet]: () => {
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
        onDialogClose()
      },
      [RteMenuOption.ImageAdd]: () => {
        if (!editor) {
          return
        }
        const url = dialogValue
        if (url === null) {
          return
        }
        editor.chain().focus().setImage({ src: url }).run()
        onDialogClose()
      },
    }),
    [editor, dialogValue, onDialogClose],
  )

  const menuButtons = useMemo(() => {
    if (customMenuOptions) {
      return customMenuOptions
        .map((option) =>
          DEFAULT_MENU_BUTTONS.find(({ label }) => label === option),
        )
        .filter((button): button is NonNullable<typeof button> => !!button)
    }

    return DEFAULT_MENU_BUTTONS
  }, [customMenuOptions])

  if (!editor) {
    return null
  }

  return (
    <>
      <div className="editor__header">
        <div className="editor__formatting">
          {menuButtons.map(({ onClick, label, icon, isActive }, index) => {
            if (!onClick) {
              return (
                <div
                  className="divider"
                  style={{
                    opacity: editable ? 1 : 0.5,
                  }}
                  key={`${label}${index}`}
                />
              )
            }
            const isDisabled =
              !editable ||
              (selectionContainsTableVariable &&
                FORMATTING_BUTTONS_DISABLED_FOR_TABLE_VARIABLE.has(label))

            return (
              <button
                key={`${label}${index}`}
                title={label}
                disabled={isDisabled}
                style={{
                  borderRadius: '0.25rem',
                  width: 'auto',
                  minWidth: 0,
                  backgroundColor: isActive?.(editor)
                    ? 'rgba(0,0,0,0.1)'
                    : 'transparent',
                  opacity: isDisabled ? 0.5 : 1,
                  cursor: isDisabled ? 'default' : 'pointer',
                }}
                className={`menu-item${isActive?.(editor) ? ' is-active' : ''}`}
                onClick={() => {
                  const clickOverride = onClickOverrides[label]
                  if (clickOverride) {
                    clickOverride()
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
        <PreviewButton
          previewType={previewType}
          editor={editor}
          variableMap={variableMap}
        />
      </div>
      {isDialogOpen && dialogLabel && (
        <AlertDialog
          leastDestructiveRef={cancelRef}
          motionPreset="none"
          returnFocusOnClose={true}
          onClose={onDialogClose}
          isOpen={true}
        >
          <AlertDialogOverlay />
          <Form onSubmit={() => dialogOnSubmits[dialogLabel]?.()}>
            <AlertDialogContent>
              <AlertDialogHeader>{dialogLabel}</AlertDialogHeader>
              <AlertDialogCloseButton />
              <AlertDialogBody ref={cancelRef}>
                <BareEditor
                  // val is in HTML, need to parse back to plain text
                  onChange={(val) => setDialogValue(parse(val).textContent)}
                  initialValue={dialogValue}
                  editable
                  variablesEnabled
                  placeholder={dialogPlaceholders[dialogLabel]}
                />
                <Box p={2}>
                  <Link
                    isExternal
                    referrerPolicy="no-referrer"
                    isDisabled={!dialogValue}
                    target="_blank"
                    href={
                      dialogValue
                        ? makeExternalLink(
                            simpleSubstitute(dialogValue, variableMap),
                          )
                        : undefined
                    }
                  >
                    Open link
                  </Link>
                </Box>
              </AlertDialogBody>
              <AlertDialogFooter>
                <Button colorScheme="primary" type="submit">
                  Done
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </Form>
        </AlertDialog>
      )}
    </>
  )
}
