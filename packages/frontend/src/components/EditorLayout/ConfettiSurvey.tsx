import './ConfettiSurvey.css'

import { useContext } from 'react'
import { useQuery } from '@apollo/client'
import { PopoverConfetti } from '@opengovsg/confetti'

import appConfig from '@/config/app'
import { EditorContext } from '@/contexts/Editor'
import { GET_FLOWS } from '@/graphql/queries/get-flows'
import useAuthentication from '@/hooks/useAuthentication'

export function ConfettiSurvey() {
  const { currentUser } = useAuthentication()

  const { flow } = useContext(EditorContext)
  const { id: flowId, role: userRole = 'Unknown role' } = flow
  const userEmail = currentUser?.email ?? 'Unknown user email'

  const steps = flow?.steps ?? []
  const stepsCount = String(steps.length)
  const stepsList = [...new Set(steps.map((s) => `${s.appKey}-${s.key}`))].join(
    ', ',
  )

  const { data: flowsData } = useQuery(GET_FLOWS, {
    variables: { limit: 1, offset: 0, active: true },
  })
  const publishedPipeCount = String(
    flowsData?.getFlows?.pageInfo?.totalCount ?? 0,
  )

  return (
    <div className="confetti-survey">
      <PopoverConfetti
        apiBaseUrl="https://confetti.plumber.gov.sg"
        surveyId={appConfig.confettiSurveyId}
        publishableKey={appConfig.confettiSurveyPublishableKey}
        respondent={`${userEmail}-${flowId}`} // key to maintain the state
        isSurveyVisible={({ lastRespondedAt, lastDismissedAt }) => {
          return !lastRespondedAt && !lastDismissedAt
        }}
        metadata={{
          userRole,
          stepsCount,
          stepsList,
          publishedPipeCount,
        }}
      />
    </div>
  )
}
