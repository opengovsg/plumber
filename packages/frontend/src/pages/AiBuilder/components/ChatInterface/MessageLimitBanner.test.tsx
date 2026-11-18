import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import MessageLimitBanner from './MessageLimitBanner'

describe('MessageLimitBanner', () => {
  it('hides Retry when the chat exceeded the size limit', () => {
    const markup = renderToStaticMarkup(
      <MessageLimitBanner
        reason="size"
        onNewChat={() => {}}
        onRetry={() => {}}
      />,
    )

    expect(markup).toContain('This chat is too long to continue')
    expect(markup).not.toContain('Retry')
  })
})
