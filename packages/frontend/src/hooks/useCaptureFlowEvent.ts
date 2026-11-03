import { useCallback, useContext } from 'react'

import { EditorContext } from '@/contexts/Editor'
import { captureFlowEvent, type FlowEvent } from '@/helpers/capture-flow-event'

export function useCaptureFlowEvent(): (event: FlowEvent) => void {
  const { flow } = useContext(EditorContext)
  const flowId = flow?.id
  return useCallback((event) => captureFlowEvent(flowId, event), [flowId])
}
