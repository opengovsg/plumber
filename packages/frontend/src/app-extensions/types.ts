import type { ButtonProps } from '@opengovsg/design-system-react'
import type { IExecutionStepMetadata, IStep } from '@plumber/types'
import type { ComponentType, ReactNode } from 'react'

export interface CheckStepButtonExtensionProps {
  step: IStep
  /**
   * The Button props the parent applied to the default button. Spread these
   * onto your own button (or ButtonGroup) when overriding so you inherit the
   * variant/size/colour/loading/disabled state.
   */
  buttonProps: Omit<ButtonProps, 'onClick'>
  /**
   * Underlying handler. Accepts optional `testRunMetadata` for apps that need
   * to vary the payload (e.g. FormSG's `{ preferMock: boolean }`).
   */
  onClick: (testRunMetadata?: Record<string, unknown>) => void
  /**
   * Defined at the "Check step again" site (after a test run).
   * Undefined at the initial "Check step" site. Extensions use this to tell
   * which site they're mounted on.
   */
  executionStepMetadata?: IExecutionStepMetadata
  /**
   * The default-rendered button. Render it to wrap (Postman tooltip), or
   * ignore it and render your own using `buttonProps` + `onClick` (FormSG).
   */
  children: ReactNode
}

export interface FrontEndAppExtension {
  /**
   * Customises the Check Step / Check Step Again button. Always mounted —
   * extensions must handle `buttonProps.isDisabled` themselves.
   */
  CheckStepButton?: ComponentType<CheckStepButtonExtensionProps>

  // Room to grow: ResultPanelWrapper, SubstepWrapper, etc.
}
