import { IExecutionStep, TDataOutMetadatumType } from '@plumber/types'

import { useMemo, useState } from 'react'

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
  hideUploadAttachments: boolean,
  priorExecutionSteps: IExecutionStep[],
  variableTypes: TDataOutMetadatumType[] | null,
) {
  const [options, setOptions] = useState<CheckboxVariable[]>([])

  const uploadedItems = useMemo(() => {
    const attachmentsConfig =
      flowData?.getFlow?.config?.attachments?.filter(Boolean) ?? []
    return reformatToCheckboxVariables(attachmentsConfig as CheckboxVariable[])
  }, [flowData])

  const suggestions = useMemo(() => {
    const filteredVars = filterVariables(
      extractVariables(priorExecutionSteps),
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
      !hideUploadAttachments && {
        id: 'uploaded',
        name: 'Uploaded attachments',
        output: uploadedItems,
        addNew: true,
      },
    ].filter(Boolean) as StepWithVariables[]
  }, [
    setOptions,
    hideUploadAttachments,
    priorExecutionSteps,
    uploadedItems,
    variableTypes,
  ])

  return {
    options,
    suggestions,
    uploadedItems,
  }
}
