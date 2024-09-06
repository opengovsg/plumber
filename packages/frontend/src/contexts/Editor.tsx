import type { IExecutionStep } from '@plumber/types'

import { createContext, ReactNode, useContext } from 'react'
import { useQuery } from '@apollo/client'

import { SINGLE_STEP_TEST_KILL_SWITCH } from '@/config/flags'
import { GET_TEST_EXECUTION_STEPS } from '@/graphql/queries/get-test-execution-steps'

import { LaunchDarklyContext } from './LaunchDarkly'

interface IEditorContextValue {
  readOnly: boolean
  testExecutionSteps: IExecutionStep[]
}

export const EditorContext = createContext<IEditorContextValue>({
  readOnly: false,
  testExecutionSteps: [],
})

type EditorProviderProps = {
  children: ReactNode
  readOnly: boolean
  flowId: string
}

export const EditorProvider = ({
  readOnly,
  flowId,
  children,
}: EditorProviderProps) => {
  // TODO: remove this kill switch once Single Step Testing is stable
  const { flags } = useContext(LaunchDarklyContext)
  const shouldUseSingleStepTest = !flags?.[SINGLE_STEP_TEST_KILL_SWITCH]

  const { data } = useQuery<{ getTestExecutionSteps: IExecutionStep[] }>(
    GET_TEST_EXECUTION_STEPS,
    {
      variables: {
        flowId,
        // ignore test execution id and fetch execution steps by ordering if SST not enabled
        ignoreTestExecutionId: !shouldUseSingleStepTest,
      },
    },
  )

  const testExecutionSteps = data?.getTestExecutionSteps ?? []

  return (
    <EditorContext.Provider
      value={{
        readOnly,
        testExecutionSteps,
      }}
    >
      {children}
    </EditorContext.Provider>
  )
}
