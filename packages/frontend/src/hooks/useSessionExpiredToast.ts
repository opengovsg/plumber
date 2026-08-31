import { useCallback } from 'react'
import { useToast } from '@opengovsg/design-system-react'

import SessionExpiredToast, {
  SESSION_EXPIRED_TOAST_ID,
} from '@/components/SessionExpiredToast'

/**
 * Returns a callback that shows the session-expired toast, letting the user
 * choose when to log in rather than navigating away from unsaved work.
 */
export function useSessionExpiredToast(): () => void {
  const toast = useToast()

  return useCallback(() => {
    if (toast.isActive(SESSION_EXPIRED_TOAST_ID)) {
      return
    }
    toast({
      id: SESSION_EXPIRED_TOAST_ID,
      duration: null,
      isClosable: false,
      position: 'top',
      render: SessionExpiredToast,
    })
  }, [toast])
}
