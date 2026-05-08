import './ConfettiSurvey.css'

import { useContext } from 'react'
import { PopoverConfetti } from '@opengovsg/confetti'

import appConfig from '@/config/app'
import { EditorContext } from '@/contexts/Editor'
import useAuthentication from '@/hooks/useAuthentication'

export function ConfettiSurvey() {
  const { currentUser } = useAuthentication()

  const { flow } = useContext(EditorContext)
  const { id: flowId, role: userRole = 'Unknown role' } = flow
  const userEmail = currentUser?.email ?? 'Unknown user email'

  return (
    <div
      className="confetti-survey"
      style={{ position: 'fixed', bottom: '1rem', right: '1rem' }}
    >
      <PopoverConfetti
        surveyId={appConfig.confettiSurveyId}
        publishableKey={appConfig.confettiSurveyPublishableKey}
        respondent={`${userEmail}-${flowId}`} // key to maintain the state
        isSurveyVisible={({ lastRespondedAt, lastDismissedAt }) => {
          return !lastRespondedAt && !lastDismissedAt
        }}
        metadata={{
          userEmail,
          userRole,
        }}
      />
    </div>
  )
}
