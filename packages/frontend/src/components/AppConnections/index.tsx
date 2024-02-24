import { useQuery } from '@apollo/client'
import NoResultFound from 'components/NoResultFound'
import * as URLS from 'config/urls'
import { graphql, getFragmentData } from 'graphql/__generated__'
import { GET_APP_CONNECTIONS } from 'graphql/queries/get-app-connections'

import ConnectionRow from './ConnectionRow'

const AppConnections_QueryFragment = graphql(`
  fragment AppConnections_QueryFragment on Query {
    getApp(key: $key) {
      connections {
        ...AppConnections_ConnectionRow_ConnectionFragment
      }
    }
  }
`)

type AppConnectionsProps = {
  appKey: string
}

export default function AppConnections(
  props: AppConnectionsProps,
): JSX.Element {
  const { appKey } = props
  const { data } = useQuery(GET_APP_CONNECTIONS, {
    variables: { key: appKey },
  })
  const appConnections = getFragmentData(AppConnections_QueryFragment, data)
    ?.getApp?.connections

  if (!appConnections || !appConnections?.length) {
    return (
      <NoResultFound
        to={URLS.APP_ADD_CONNECTION(appKey)}
        text="You don't have any connections yet."
      />
    )
  }

  return (
    <>
      {appConnections.map((appConnection, index) => (
        <ConnectionRow key={index} connection={appConnection} />
      ))}
    </>
  )
}
