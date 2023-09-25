import { createContext } from 'react'

interface BranchContextData {
  depth: number
}

export const BranchContext = createContext<BranchContextData>({
  depth: 0,
})
