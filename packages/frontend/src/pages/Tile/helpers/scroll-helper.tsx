import { RefObject } from 'react'

import { DELAY } from '../constants'

export function scrollToBottom(parentRef: RefObject<HTMLDivElement>) {
  setTimeout(() => {
    if (!parentRef.current) {
      return
    }
    parentRef.current.scrollTo({
      top: parentRef.current.scrollHeight,
      behavior: 'auto',
    })
  }, DELAY.SCROLL)
}

export function scrollToTop(parentRef: RefObject<HTMLDivElement>) {
  setTimeout(() => {
    if (!parentRef.current) {
      return
    }
    parentRef.current?.scrollTo({
      top: 0,
      behavior: 'auto',
    })
  }, DELAY.SCROLL)
}
