import type { IConnection } from '@plumber/types'

import * as React from 'react'
import { useQuery } from '@apollo/client'

import AppConnectionRow from '@/components/AppConnectionRow'
import NoResultFound from '@/components/NoResultFound'
import { GET_APP_CONNECTIONS } from '@/graphql/queries/get-app-connections'

type AppConnectionsProps = {
  appKey: string
}

export default function AppConnections(
  props: AppConnectionsProps,
): React.ReactElement {
  const { appKey } = props
  const { data, loading } = useQuery(GET_APP_CONNECTIONS, {
    variables: { key: appKey },
  })
  const appConnections: IConnection[] = data?.getApp?.connections || []

  const hasConnections = appConnections?.length

  if (!loading && !hasConnections) {
    return (
      <NoResultFound
        description="No connections found"
        action="Connections will appear here when you create and use a connection in your pipe."
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
