import { IFlow } from '@plumber/types'

import { ReactElement, useState } from 'react'

import { usePaginationAndFilter } from '@/hooks/usePaginationAndFilter'

import ExecutionListPage from './components/ExecutionListPage'
import FlowListPage from './components/FlowListPage'

export default function Executions(): ReactElement {
  const { searchParams } = usePaginationAndFilter()
  const flowId = searchParams.get('pipeId') || ''
  const [flows, setFlows] = useState<IFlow[]>([])

  const flow = flows.find((flow) => flow.id === flowId)

  if (flowId && flow) {
    return <ExecutionListPage flow={flow} />
  }

  return <FlowListPage setFlows={setFlows} />
}
