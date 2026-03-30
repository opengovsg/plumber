import { useCallback, useLayoutEffect, useRef, useState } from 'react'

interface UseNavigationGuardOptions {
  /**
   * Whether the guard is active. Pass a boolean or a function.
   * When false, all navigation proceeds without warning.
   */
  when: boolean | (() => boolean)

  /**
   * Called when the user confirms they want to leave (before navigation fires).
   * Use this to clear persisted state, reset stores, etc.
   */
  onLeave?: () => void

  /**
   * Called to navigate away when the browser back button is used.
   * Required to ensure safe navigation behavior.
   * Typically: () => navigate('/destination', { replace: true })
   */
  navigateBack: () => void
}

interface NavigationGuardState {
  /** Whether the confirmation modal is currently visible */
  showWarning: boolean

  /**
   * Call this to attempt a guarded navigation (e.g. your close button).
   * If the guard is active, it shows the warning and stashes the callback.
   * If not, it executes onLeave + the callback immediately.
   */
  guardedNavigate: (onConfirm: () => void) => void

  /** User confirmed — execute onLeave + the stashed navigation */
  confirm: () => void

  /** User cancelled — dismiss the warning, stay on page */
  cancel: () => void
}

/**
 * Navigation guard that handles two scenarios:
 *
 * 1. **Browser back button** — intercepts popstate, re-pushes current URL
 *    to prevent navigation, shows your custom warning modal.
 *
 * 2. **In-app close button** — call `guardedNavigate(callback)`. If the guard
 *    is active, shows the warning first. On confirm, fires onLeave then the callback.
 *
 * State is assumed to already be persisted (via usePersistedState or similar).
 * This hook does NOT handle saving — it only blocks navigation and fires onLeave on exit.
 *
 * Note: This hook does NOT warn on tab close or refresh to allow state persistence
 * across page reloads without user interruption.
 *
 * @example
 * const navigate = useNavigate()
 * const { showWarning, guardedNavigate, confirm, cancel } = useNavigationGuard({
 *   when: hasUnsavedChanges,
 *   onLeave: clearDraft,
 *   navigateBack: () => navigate('/flows', { replace: true }),
 * })
 */
export function useNavigationGuard({
  when,
  onLeave,
  navigateBack,
}: UseNavigationGuardOptions): NavigationGuardState {
  const [showWarning, setShowWarning] = useState(false)

  const pendingNavigationRef = useRef<(() => void) | null>(null)

  const onLeaveRef = useRef(onLeave)
  onLeaveRef.current = onLeave

  const navigateBackRef = useRef(navigateBack)
  navigateBackRef.current = navigateBack

  const isActiveRef = useRef(false)
  isActiveRef.current = typeof when === 'function' ? when() : when

  // --- 1. popstate (browser back / forward) ---
  useLayoutEffect(() => {
    // Always set up the handler, but only act if the guard is active
    // Push a dummy state so pressing back lands on it instead of leaving
    window.history.pushState({ navigationGuard: true }, '')

    const handler = (_e: PopStateEvent) => {
      if (!isActiveRef.current) {
        // Guard not active, allow navigation
        return
      }

      // Re-push immediately to prevent the browser from navigating away
      window.history.pushState({ navigationGuard: true }, '')

      // Stash a "go back for real" callback
      pendingNavigationRef.current = () => {
        onLeaveRef.current?.()
        navigateBackRef.current()
      }

      setShowWarning(true)
    }

    window.addEventListener('popstate', handler)

    return () => {
      window.removeEventListener('popstate', handler)
      if (window.history.state?.navigationGuard) {
        window.history.back()
      }
    }
  }, [])

  // --- 2. In-app navigation (close button, etc.) ---
  const guardedNavigate = useCallback((onConfirm: () => void) => {
    if (!isActiveRef.current) {
      onLeaveRef.current?.()
      onConfirm()
      return
    }
    pendingNavigationRef.current = onConfirm
    setShowWarning(true)
  }, [])

  const confirm = useCallback(() => {
    setShowWarning(false)
    onLeaveRef.current?.()
    const nav = pendingNavigationRef.current
    pendingNavigationRef.current = null
    nav?.()
  }, [])

  const cancel = useCallback(() => {
    setShowWarning(false)
    pendingNavigationRef.current = null
  }, [])

  return { showWarning, guardedNavigate, confirm, cancel }
}
