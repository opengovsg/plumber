import * as React from 'react'
import { Route, Routes } from 'react-router-dom'
import EditorSettingsLayout from 'components/EditorSettings'
import Notifications from 'components/EditorSettings/Notifications'

import CreateFlowPage from './create'
import EditorPage from './index'

export default function EditorRoutes(): React.ReactElement {
  return (
    <Routes>
      <Route path="/create" element={<CreateFlowPage />} />

      <Route path="/:flowId" element={<EditorPage />} />

      <Route
        path="/:flowId/notifications"
        element={
          <EditorSettingsLayout>
            <Notifications />
          </EditorSettingsLayout>
        }
      />
    </Routes>
  )
}
