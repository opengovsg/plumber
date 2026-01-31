import { IStep, IStepApprovalBranch } from '@plumber/types'

import { createContext, useContext, useState } from 'react'
import get from 'lodash/get'

import { FORMSG_APP_KEY, MRF_ACTION_KEY } from '@/helpers/formsg'

import { EditorContext } from './Editor'

interface MrfContextReturnValue {
  mrfSteps: IStep[]
  mrfApprovalSteps: IStep[]
  approvalBranches: {
    [stepId: string]: IStepApprovalBranch
  }
  setApprovalBranch: (stepId: string, branch: IStepApprovalBranch) => void
  disabledMrfStepToDisplay: IStep | null
}

export const MrfContext = createContext<MrfContextReturnValue>({
  mrfSteps: [],
  mrfApprovalSteps: [],
  approvalBranches: {},
  setApprovalBranch: () => null,
  disabledMrfStepToDisplay: null,
})

interface MrfContextProviderProps {
  children: React.ReactNode
}

export const MrfContextProvider = ({ children }: MrfContextProviderProps) => {
  const { flow } = useContext(EditorContext)

  const [disabledMrfStepToDisplay, setDisabledMrfStepToDisplay] =
    useState<IStep | null>(null)

  const mrfSteps = flow.steps.filter(
    (step) => step.appKey === FORMSG_APP_KEY && step.key === MRF_ACTION_KEY,
  )

  const mrfApprovalSteps = mrfSteps.filter(
    (step) => !!get(step.parameters, 'mrf.approvalField', false),
  )

  const [approvalBranches, setApprovalBranches] = useState<
    Record<string, IStepApprovalBranch>
  >({
    ...mrfApprovalSteps.reduce((acc, step) => {
      acc[step.id] = 'approve'
      return acc
    }, {} as Record<string, IStepApprovalBranch>),
  })

  const setApprovalBranch = (stepId: string, branch: IStepApprovalBranch) => {
    setApprovalBranches((prev) => ({
      ...prev,
      [stepId]: branch,
    }))
    if (branch === 'reject') {
      const nextMrfStepId =
        mrfSteps[mrfSteps.findIndex((mrfStep) => mrfStep.id === stepId) + 1]
      setDisabledMrfStepToDisplay(nextMrfStepId ?? null)
    } else {
      setDisabledMrfStepToDisplay(null)
    }
  }

  return (
    <MrfContext.Provider
      value={{
        mrfSteps,
        mrfApprovalSteps,
        approvalBranches,
        setApprovalBranch,
        disabledMrfStepToDisplay,
      }}
    >
      {children}
    </MrfContext.Provider>
  )
}
