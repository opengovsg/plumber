import { RefObject } from 'react'

import { DELAY } from '../constants'

export function scrollToBottom(parentRef: RefObject<HTMLDivElement>) {
  setTimeout(() => {
    if (!parentRef.current) {
      return
    }
    if (
      parentRef.current.scrollHeight - parentRef.current.scrollTop >
      parentRef.current.clientHeight * 10
    ) {
      parentRef.current.style.scrollBehavior = 'auto'
    }
    parentRef.current.scrollTo({
      top: parentRef.current.scrollHeight,
      behavior: 'auto',
    })
    parentRef.current.style.scrollBehavior = 'smooth'
  }, DELAY.SCROLL)
}

export function scrollToTop(parentRef: RefObject<HTMLDivElement>) {
  setTimeout(() => {
    if (!parentRef.current) {
      return
    }
    if (parentRef.current.scrollTop > parentRef.current.clientHeight * 10) {
      parentRef.current.style.scrollBehavior = 'auto'
    }
    parentRef.current?.scrollTo({
      top: 0,
      behavior: 'auto',
    })
    parentRef.current.style.scrollBehavior = 'smooth'
  }, DELAY.SCROLL)
}
