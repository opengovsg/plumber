import { IStep, IStepApprovalBranch } from '@plumber/types'

import { createContext, useState } from 'react'
import get from 'lodash/get'

import { FORMSG_APP_KEY, MRF_ACTION_KEY } from '@/helpers/formsg'

interface MrfContextReturnValue {
  mrfSteps: IStep[]
  mrfApprovalSteps: IStep[]
  approvalBranches: {
    [stepId: string]: IStepApprovalBranch
  }
  setApprovalBranch: (stepId: string, branch: IStepApprovalBranch) => void
}

export const MrfContext = createContext<MrfContextReturnValue>({
  mrfSteps: [],
  mrfApprovalSteps: [],
  approvalBranches: {},
  setApprovalBranch: () => null,
})

interface MrfContextProviderProps {
  children: React.ReactNode
  steps: IStep[]
}

export const MrfContextProvider = ({
  children,
  steps,
}: MrfContextProviderProps) => {
  const mrfSteps = steps.filter(
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
  }

  return (
    <MrfContext.Provider
      value={{
        mrfSteps,
        mrfApprovalSteps,
        approvalBranches,
        setApprovalBranch,
      }}
    >
      {children}
    </MrfContext.Provider>
  )
}
