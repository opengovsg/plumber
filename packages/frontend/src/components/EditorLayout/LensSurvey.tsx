import { useCallback, useContext } from 'react'
import { useMutation } from '@apollo/client'
import { Rating } from 'lens-widget'

import appConfig from '@/config/app'
import { EditorContext } from '@/contexts/Editor'
import { UPDATE_FLOW_CONFIG } from '@/graphql/mutations/update-flow-config'
import useAuthentication from '@/hooks/useAuthentication'

export function LensSurvey() {
  const { currentUser } = useAuthentication()

  const { flowId } = useContext(EditorContext)

  const [updateFlowConfig] = useMutation(UPDATE_FLOW_CONFIG)
  const onFlowConfigUpdate = useCallback(async () => {
    await updateFlowConfig({
      variables: { input: { id: flowId, showSurvey: false } },
    })
  }, [updateFlowConfig, flowId])

  return (
    <Rating
      clientKey={appConfig.lensSurveyClientKey}
      brandColour="#cf1a68"
      attributes={[`FlowId: ${flowId}`, `UserEmail: ${currentUser?.email}`]}
      onSubmit={onFlowConfigUpdate}
      onClose={onFlowConfigUpdate}
    />
  )
}
