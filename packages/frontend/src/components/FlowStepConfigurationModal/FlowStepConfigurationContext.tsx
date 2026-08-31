// generate a context for the flow step configuration modal

import { IAction, IApp, IStep, ITrigger } from '@plumber/types'

import { createContext, useCallback, useState } from 'react'

import type { AnchorPlacement } from './helpers/anchor-placement'

interface FlowStepConfigurationContextValue {
  modalState: ModalState
  patchModalState: (modalState: Partial<ModalState>) => void
  isTrigger: boolean
  isLastStep: boolean
  prevStep?: IStep
  prevStepId?: string
  step?: IStep
  // Set only when the modal is launched from an if-then block's add-after
  // affordance. Sent on the CREATE_STEP so the backend places the new step
  // after the named block and (for an if-then V1 block) pins its extent.
  previousBlockId?: string
  // Set only by the affordances whose anchor step misrepresents where their
  // new step lands relative to an if-then block. See AnchorPlacement.
  anchorPlacement?: AnchorPlacement
}

export const FlowStepConfigurationContext =
  createContext<FlowStepConfigurationContextValue>({
    modalState: {
      currentScreen: 'choose-app',
      selectedApp: null,
      selectedEvent: null,
      selectedConnectionId: '',
      isLoading: false,
    },
    patchModalState: () => null,
    isTrigger: false,
    isLastStep: false,
    step: undefined,
  })

export type ModalScreen =
  | 'choose-app'
  | 'choose-event'
  | 'choose-connection'
  | 'add-connection'
  | 'configure-excel-connection'
  | 'configure-databricks-connection'

export type ModalState = {
  currentScreen: ModalScreen
  selectedApp: IApp | null
  selectedEvent: ITrigger | IAction | null
  selectedConnectionId: string
  isLoading: boolean
}

interface FlowStepConfigurationContextProps {
  step?: IStep
  app?: IApp
  event?: ITrigger | IAction
  isTrigger: boolean
  isLastStep: boolean
  prevStep?: IStep
  previousBlockId?: string
  anchorPlacement?: AnchorPlacement
  children: React.ReactNode
}

export const FlowStepConfigurationContextProvider = ({
  step,
  app,
  event,
  isTrigger,
  isLastStep,
  prevStep,
  previousBlockId,
  anchorPlacement,
  children,
}: FlowStepConfigurationContextProps) => {
  const [modalState, setModalState] = useState<ModalState>({
    currentScreen: app && event ? 'choose-connection' : 'choose-app',
    selectedApp: app ?? null,
    selectedEvent: event ?? null,
    selectedConnectionId: step?.connection?.id ?? '',
    isLoading: false,
  })

  const patchModalState = useCallback((newState: Partial<ModalState>) => {
    setModalState((prevState) => ({ ...prevState, ...newState }))
  }, [])

  return (
    <FlowStepConfigurationContext.Provider
      value={{
        modalState,
        patchModalState,
        isTrigger,
        isLastStep,
        prevStep,
        prevStepId: prevStep?.id,
        step,
        previousBlockId,
        anchorPlacement,
      }}
    >
      {children}
    </FlowStepConfigurationContext.Provider>
  )
}
