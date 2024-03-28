import React from 'react'
import { common, createLowlight } from 'lowlight'
import javascript from 'highlight.js/lib/languages/javascript'

import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { EditorContent, useEditor } from '@tiptap/react'

import './styles.scss'

const lowlight = createLowlight(common)
lowlight.register('javascript', javascript)

const JavaScriptEditor = () => {
  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      CodeBlockLowlight
        .configure({ lowlight, defaultLanguage: 'javascript' }),
    ],
    content: `
        <pre><code class="language-javascript">for (var i=1; i <= 20; i++)
    {
      if (i % 15 == 0)
        console.log("FizzBuzz");
      else if (i % 3 == 0)
        console.log("Fizz");
      else if (i % 5 == 0)
        console.log("Buzz");
      else
        console.log(i);
    }</code></pre>
        <p>
          Press Command/Ctrl + Enter to leave the fenced code block and continue typing in boring paragraphs.
        </p>
      `,
  })

  if (!editor) return <React.Fragment />
  return (
    <EditorContent editor={editor} />
  )
}

export default JavaScriptEditor
