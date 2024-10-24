import * as React from 'react'
import { Route, Routes } from 'react-router-dom'

import EditorSettingsLayout from '@/components/EditorSettings'
import FlowTransfer from '@/components/EditorSettings/FlowTransfer'
import Notifications from '@/components/EditorSettings/Notifications'

import EditorPage from './index'

export default function EditorRoutes(): React.ReactElement {
  return (
    <Routes>
      <Route path="/:flowId" element={<EditorPage />} />

      <Route
        path="/:flowId/notifications"
        element={
          <EditorSettingsLayout>
            <Notifications />
          </EditorSettingsLayout>
        }
      />
      <Route
        path="/:flowId/transfer"
        element={
          <EditorSettingsLayout>
            <FlowTransfer />
          </EditorSettingsLayout>
        }
      />
    </Routes>
  )
}
