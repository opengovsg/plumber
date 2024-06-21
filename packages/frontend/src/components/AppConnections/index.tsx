import { useQuery } from '@apollo/client'
import AppConnectionRow from 'components/AppConnectionRow'
import NoResultFound from 'components/NoResultFound'
import * as URLS from 'config/urls'
import { GET_APP_CONNECTIONS } from 'graphql/queries/get-app-connections'

type AppConnectionsProps = {
  appKey: string
}

export default function AppConnections(
  props: AppConnectionsProps,
): React.ReactElement {
  const { appKey } = props
  const { data } = useQuery(GET_APP_CONNECTIONS, {
    variables: { key: appKey },
  })
  const appConnections = data?.getApp?.connections ?? []
  const hasConnections = appConnections?.length

  if (!hasConnections) {
    return (
      <NoResultFound
        to={URLS.APP_ADD_CONNECTION(appKey)}
        text="You don't have any connections yet."
      />
    )
  }

  return (
    <>
      {appConnections.map((appConnection) => (
        <AppConnectionRow key={appConnection.id} connection={appConnection} />
      ))}
    </>
  )
}
