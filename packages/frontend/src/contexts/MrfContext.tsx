import { IStep } from '@plumber/types'

import { createContext, useContext, useState } from 'react'

import { FORMSG_APP_KEY, MRF_ACTION_KEY } from '@/helpers/formsg'

type ApprovalBranch = 'approve' | 'reject'

interface MrfContextReturnValue {
  mrfSteps: IStep[]
  approvalBranches: {
    [stepId: string]: ApprovalBranch
  }
  setApprovalBranch: (stepId: string, branch: ApprovalBranch) => void
}

const MrfContext = createContext<MrfContextReturnValue | undefined>(undefined)

export const useMrfContext = () => {
  const context = useContext(MrfContext)
  if (!context) {
    throw new Error('useMrfContext must be used within a MrfContextProvider')
  }
  return context
}

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

  const [approvalBranches, setApprovalBranches] = useState<
    Record<string, ApprovalBranch>
  >({
    ...mrfSteps.reduce((acc, step) => {
      acc[step.id] = 'approve'
      return acc
    }, {} as Record<string, ApprovalBranch>),
  })

  const setApprovalBranch = (stepId: string, branch: ApprovalBranch) => {
    setApprovalBranches((prev) => ({
      ...prev,
      [stepId]: branch,
    }))
  }

  return (
    <MrfContext.Provider
      value={{
        mrfSteps,
        approvalBranches,
        setApprovalBranch,
      }}
    >
      {children}
    </MrfContext.Provider>
  )
}
