import type { IExecutionStep } from '@plumber/types'

import { createContext, ReactNode } from 'react'
import { useQuery } from '@apollo/client'
import { GET_TEST_EXECUTION_STEPS } from 'graphql/queries/get-test-execution-steps'

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
  const { data } = useQuery<{ getTestExecutionSteps: IExecutionStep[] }>(
    GET_TEST_EXECUTION_STEPS,
    {
      variables: {
        flowId,
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
