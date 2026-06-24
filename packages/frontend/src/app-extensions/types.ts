import type { IStep } from '@plumber/types'

import type { ComponentType, ReactNode } from 'react'

export interface CheckStepButtonExtensionProps {
  step: IStep
  /** The Check Step / Check Step Again button itself. */
  children: ReactNode
}

export interface FrontEndAppExtension {
  /**
   * Wraps the Check Step / Check Step Again button.
   *
   * Mounted ONLY WHEN the button is enabled.
   * TBD: Allow extending when button is disabled (for showing custom failure
   *      tooltip etc)
   **/
  CheckStepButton?: ComponentType<CheckStepButtonExtensionProps>

  // Room to grow: ResultPanelWrapper, SubstepWrapper, etc.
}
