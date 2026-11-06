// Space left under the panel, so it does not sit at the very bottom edge.
const REVEAL_BOTTOM_MARGIN_PX = 48
const REVEAL_TOP_MARGIN_PX = 16
const REVEAL_DURATION_MS = 320
const RELEASE_DELAY_MS = 200

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * How far to scroll down so the whole panel is visible, without pushing the
 * input it belongs to off the top.
 */
export function getRevealScrollDelta(params: {
  panelBottom: number
  viewportBottom: number
  inputTop: number
  viewportTop: number
  bottomMargin?: number
  topMargin?: number
}): number {
  const {
    panelBottom,
    viewportBottom,
    inputTop,
    viewportTop,
    bottomMargin = REVEAL_BOTTOM_MARGIN_PX,
    topMargin = REVEAL_TOP_MARGIN_PX,
  } = params

  const needed = panelBottom + bottomMargin - viewportBottom
  if (needed <= 0) {
    return 0
  }
  const roomAboveInput = Math.max(0, inputTop - viewportTop - topMargin)
  return Math.min(needed, roomAboveInput)
}

export function getScrollParent(element: HTMLElement): HTMLElement {
  let node: HTMLElement | null = element.parentElement
  while (node) {
    const { overflowY } = getComputedStyle(node)
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight
    ) {
      return node
    }
    node = node.parentElement
  }
  return (document.scrollingElement ?? document.documentElement) as HTMLElement
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Scrolls a container to `target` with an eased motion.
 * Returns a function that stops the animation.
 */
export function animateScrollTo(
  container: HTMLElement,
  target: number,
  onDone?: () => void,
): () => void {
  const start = container.scrollTop
  const distance = target - start
  if (distance === 0 || prefersReducedMotion()) {
    container.scrollTop = target
    onDone?.()
    return () => undefined
  }

  const startedAt = performance.now()
  let frame = 0
  const step = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / REVEAL_DURATION_MS)
    container.scrollTop = start + distance * easeInOutCubic(progress)
    if (progress < 1) {
      frame = requestAnimationFrame(step)
    } else {
      onDone?.()
    }
  }
  frame = requestAnimationFrame(step)
  return () => cancelAnimationFrame(frame)
}

interface ReservedSpace {
  originalPaddingBottom: string
  added: number
  releaseTimer?: ReturnType<typeof setTimeout>
}

const reservedSpace = new WeakMap<HTMLElement, ReservedSpace>()

/**
 * A panel opened by the last field extends past the end of the scrollable
 * content, so the container gets temporary bottom space to scroll into.
 * Returns a release function. It waits briefly so moving focus between fields
 * does not make the page jump back and forth.
 */
export function reserveBottomSpace(
  container: HTMLElement,
  extra: number,
): () => void {
  const existing = reservedSpace.get(container)
  if (existing?.releaseTimer) {
    clearTimeout(existing.releaseTimer)
    existing.releaseTimer = undefined
  }

  const record: ReservedSpace = existing ?? {
    originalPaddingBottom: container.style.paddingBottom,
    added: 0,
  }
  const current = parseFloat(getComputedStyle(container).paddingBottom) || 0
  container.style.paddingBottom = `${current + extra}px`
  record.added += extra
  reservedSpace.set(container, record)

  return () => {
    record.releaseTimer = setTimeout(() => {
      const addedSpace = record.added
      const settledScrollTop = Math.max(
        0,
        container.scrollHeight - container.clientHeight - addedSpace,
      )
      animateScrollTo(
        container,
        Math.min(container.scrollTop, settledScrollTop),
        () => {
          container.style.paddingBottom = record.originalPaddingBottom
          reservedSpace.delete(container)
        },
      )
    }, RELEASE_DELAY_MS)
  }
}
