import './ConfettiSurvey.css'

import { useContext } from 'react'
import { PopoverConfetti } from '@opengovsg/confetti'

import appConfig from '@/config/app'
import { EditorContext } from '@/contexts/Editor'
import useAuthentication from '@/hooks/useAuthentication'

export function ConfettiSurvey() {
  const { currentUser } = useAuthentication()

  const { flowId } = useContext(EditorContext)

  return (
    <div
      className="confetti-survey"
      style={{ position: 'fixed', bottom: '1rem', right: '1rem' }}
    >
      <PopoverConfetti
        surveyId={appConfig.confettiSurveyId}
        publishableKey={appConfig.confettiSurveyPublishableKey}
        respondent={flowId} // key to maintain the state
        isSurveyVisible={({ lastRespondedAt, lastDismissedAt }) => {
          return !lastRespondedAt && !lastDismissedAt
        }}
        metadata={{
          UserEmail: currentUser?.email ?? 'Unknown user email',
        }}
      />
    </div>
  )
}
