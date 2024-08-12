import type { IConnection } from '@plumber/types'

import * as React from 'react'
import { useQuery } from '@apollo/client'

import AppConnectionRow from '@/components/AppConnectionRow'
import NoResultFound from '@/components/NoResultFound'
import * as URLS from '@/config/urls'
import { GET_APP_CONNECTIONS } from '@/graphql/queries/get-app-connections'
import useFormatMessage from '@/hooks/useFormatMessage'

type AppConnectionsProps = {
  appKey: string
}

export default function AppConnections(
  props: AppConnectionsProps,
): React.ReactElement {
  const { appKey } = props
  const formatMessage = useFormatMessage()
  const { data } = useQuery(GET_APP_CONNECTIONS, {
    variables: { key: appKey },
  })
  const appConnections: IConnection[] = data?.getApp?.connections || []

  const hasConnections = appConnections?.length

  if (!hasConnections) {
    return (
      <NoResultFound
        to={URLS.APP_ADD_CONNECTION(appKey)}
        text={formatMessage('app.noConnections')}
      />
    )
  }

  return (
    <>
      {appConnections.map((appConnection: IConnection) => (
        <AppConnectionRow key={appConnection.id} connection={appConnection} />
      ))}
    </>
  )
}
