import type { FrontEndAppExtension } from '@/app-extensions/types'

import CheckStepButton from './triggers/check-step-button'

const extensions = {
  'formsg-newSubmission': {
    CheckStepButton: CheckStepButton,
  },
  'formsg-mrfSubmission': {
    CheckStepButton: CheckStepButton,
  },
} satisfies Record<string, FrontEndAppExtension>

export default extensions
