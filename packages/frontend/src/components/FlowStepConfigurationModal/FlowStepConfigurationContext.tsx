// generate a context for the flow step configuration modal

import { IAction, IApp, IStep, ITrigger } from '@plumber/types'

import { createContext, useCallback, useState } from 'react'

// Runs after the modal creates a step (after the editor's onCreateStep and its
// refetch), receiving the created step. Used e.g. to repoint an if-then block's
// last branch at the new step; the hook issues its own write + refetch.
export type OnAfterCreateStep = (createdStep: IStep) => Promise<void>

interface FlowStepConfigurationContextValue {
  modalState: ModalState
  patchModalState: (modalState: Partial<ModalState>) => void
  isTrigger: boolean
  isLastStep: boolean
  prevStep?: IStep
  prevStepId?: string
  step?: IStep
  // Optional hook forwarded to the editor's onCreateStep, run after the step is
  // created (e.g. to repoint an if-then block's last branch at the new step).
  onAfterCreateStep?: OnAfterCreateStep
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
  onAfterCreateStep?: OnAfterCreateStep
  children: React.ReactNode
}

export const FlowStepConfigurationContextProvider = ({
  step,
  app,
  event,
  isTrigger,
  isLastStep,
  prevStep,
  onAfterCreateStep,
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
        onAfterCreateStep,
      }}
    >
      {children}
    </FlowStepConfigurationContext.Provider>
  )
}
