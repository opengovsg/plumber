import { useCallback, useState } from 'react'

import { LATEST_ANNOUNCEMENT_MODAL_TIMESTAMP } from './constants'

const LOCAL_STORAGE_ANNOUNCEMENT_LAST_OPENED_KEY =
  'announcement-modal-last-opened'

/**
 * Tracks whether the user has already dismissed the latest announcement.
 * Bump LATEST_ANNOUNCEMENT_MODAL_TIMESTAMP to show a new one to everybody.
 */
export function useAnnouncementModal() {
  const [lastOpenedTimestamp, setLastOpenedTimestamp] = useState(() =>
    localStorage.getItem(LOCAL_STORAGE_ANNOUNCEMENT_LAST_OPENED_KEY),
  )

  const dismiss = useCallback(() => {
    localStorage.setItem(
      LOCAL_STORAGE_ANNOUNCEMENT_LAST_OPENED_KEY,
      LATEST_ANNOUNCEMENT_MODAL_TIMESTAMP,
    )
    setLastOpenedTimestamp(LATEST_ANNOUNCEMENT_MODAL_TIMESTAMP)
  }, [])

  return {
    hasSeenLatestAnnouncement:
      lastOpenedTimestamp === LATEST_ANNOUNCEMENT_MODAL_TIMESTAMP,
    dismiss,
  }
}
