import { RefObject } from 'react'

import { DELAY } from '../constants'

export function scrollToBottom(parentRef: RefObject<HTMLDivElement>) {
  setTimeout(() => {
    parentRef.current?.scrollTo({
      top: parentRef.current.scrollHeight,
      behavior:
        parentRef.current.scrollHeight - parentRef.current.scrollTop <
        parentRef.current.clientHeight * 10
          ? 'smooth'
          : 'auto',
    })
  }, DELAY.SCROLL)
}

export function scrollToTop(parentRef: RefObject<HTMLDivElement>) {
  setTimeout(() => {
    parentRef.current?.scrollTo({
      top: 0,
      behavior:
        parentRef.current.scrollTop < parentRef.current.clientHeight * 10
          ? 'smooth'
          : 'auto',
    })
  }, DELAY.SCROLL)
}
