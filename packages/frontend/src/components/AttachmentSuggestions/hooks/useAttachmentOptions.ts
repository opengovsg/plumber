import { IExecutionStep, TDataOutMetadatumType } from '@plumber/types'

import { useContext, useMemo, useState } from 'react'

import { EditorContext } from '@/contexts/Editor'
import { GetFlowQuery } from '@/graphql/__generated__/graphql'
import {
  extractVariables,
  filterVariables,
  StepWithVariables,
  Variable,
} from '@/helpers/variables'

import { CheckboxVariable } from '../components/Checkbox'
import { reformatToCheckboxVariables } from '../utils'

export function useAttachmentOptions(
  flowData: GetFlowQuery,
  priorExecutionSteps: IExecutionStep[],
  variableTypes: TDataOutMetadatumType[] | null,
) {
  const { allApps } = useContext(EditorContext)
  const [options, setOptions] = useState<CheckboxVariable[]>([])

  const uploadedItems = useMemo(() => {
    const attachmentsConfig =
      flowData?.getFlow?.config?.attachments?.filter(Boolean) ?? []
    return reformatToCheckboxVariables(attachmentsConfig as CheckboxVariable[])
  }, [flowData])

  const suggestions = useMemo(() => {
    const filteredVars = filterVariables(
      extractVariables(priorExecutionSteps, allApps),
      (v: Variable) => {
        const variableType = v.type ?? 'text'
        return variableTypes?.includes(variableType) ?? false
      },
    ).map((v) => ({
      ...v,
      // NOTE: add the source to display in the tag
      output: v.output.map((o) => ({ ...o, source: v.name })),
    }))

    setOptions([
      ...filteredVars.reduce((acc: CheckboxVariable[], v) => {
        const { output } = v
        acc.push(...output)
        return acc
      }, []),
      ...uploadedItems,
    ])

    return [
      ...filteredVars,
      {
        id: 'uploaded',
        name: 'Uploaded attachments',
        output: uploadedItems,
        addNew: true,
      },
    ].filter(Boolean) as StepWithVariables[]
  }, [priorExecutionSteps, allApps, uploadedItems, variableTypes])

  return {
    options,
    suggestions,
    uploadedItems,
  }
}
