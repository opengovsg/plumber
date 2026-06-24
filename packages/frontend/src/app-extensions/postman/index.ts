import type { FrontEndAppExtension } from '@/app-extensions/types'

import CheckStepButton from './actions/send-transactional-email/check-step-button'

const extensions = {
  'postman-sendTransactionalEmail': {
    CheckStepButton: CheckStepButton,
  },
} satisfies Record<string, FrontEndAppExtension>

export default extensions
