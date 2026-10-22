import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { CONTINUE_PROMPT } from '@/pages/AiBuilder/constants'

import ChatMessage from './ChatMessage'

vi.mock('@/theme/components/Streamdown', () => ({
  ChakraStreamdown: () => null,
}))
vi.mock('./ChatMessageToolbar', () => ({ default: () => null }))

describe('ChatMessage', () => {
  it('shows user text that matches the Continue prompt', () => {
    const markup = renderToStaticMarkup(
      <ChatMessage
        message={{
          id: 'user-1',
          text: CONTINUE_PROMPT,
          isUser: true,
          isChatReady: false,
        }}
        shouldShowPreview={false}
        shouldShowToolbar={false}
      />,
    )

    expect(markup).toContain(CONTINUE_PROMPT)
  })
})
