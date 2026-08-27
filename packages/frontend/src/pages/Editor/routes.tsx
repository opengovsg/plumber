import * as React from 'react'
import { Route, Routes } from 'react-router-dom'

import EditorSettingsLayout from '@/components/EditorSettings'
import FlowCollaborators from '@/components/EditorSettings/FlowCollaborators'
import FlowConnections from '@/components/EditorSettings/FlowConnections'
import FlowTransfer from '@/components/EditorSettings/FlowTransfer'
import Notifications from '@/components/EditorSettings/Notifications'
import RedirectToLogin from '@/components/RedirectToLogin'
import useAuthentication from '@/hooks/useAuthentication'

import AiBuilder from '../AiBuilder'

import EditorPage from './index'

function AuthenticatedAiBuilder() {
  const { currentUser } = useAuthentication()
  if (!currentUser) {
    return <RedirectToLogin />
  }
  return <AiBuilder />
}

export default function EditorRoutes(): React.ReactElement {
  return (
    <Routes>
      <Route path="/ai" element={<AuthenticatedAiBuilder />} />
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
        path="/:flowId/share"
        element={
          <EditorSettingsLayout>
            <FlowCollaborators />
          </EditorSettingsLayout>
        }
      />
      <Route
        path="/:flowId/connections"
        element={
          <EditorSettingsLayout>
            <FlowConnections />
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
