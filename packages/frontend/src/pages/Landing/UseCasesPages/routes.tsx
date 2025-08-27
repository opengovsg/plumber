import { Route, Routes } from 'react-router-dom'

import CampaignManagement from './CampaignManagement'
import CustomerSupport from './CustomerSupport'
import HumanResource from './HumanResource'
import Operations from './Operations'

const SUBPAGES_MAP: Record<string, JSX.Element> = {
  'human-resource': <HumanResource />,
  operations: <Operations />,
  'customer-support': <CustomerSupport />,
  'campaign-management': <CampaignManagement />,
}

export default function UseCasesRoutes() {
  return (
    <Routes>
      {Object.keys(SUBPAGES_MAP).map((subpage: string) => (
        <Route
          key={subpage}
          path={`/${subpage}`}
          element={SUBPAGES_MAP[subpage]}
        />
      ))}
    </Routes>
  )
}
