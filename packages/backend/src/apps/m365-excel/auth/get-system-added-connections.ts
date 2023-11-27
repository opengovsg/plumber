import type { ISystemAddedConnectionAuth } from '@plumber/types'

import { type PartialModelObject } from 'objection'

import { getM365TenantInfo, M365TenantKey } from '@/config/app-env-vars/m365'
import type Connection from '@/models/connection'
import User from '@/models/user'

import { APP_KEY } from '../common/constants'
import getEligibleTenantKeys from '../common/get-eligible-tenant-keys'

function getCurrentTenantKeys(connections: Connection[]): ReadonlySet<string> {
  return new Set(
    connections
      .map(
        (connection) =>
          connection.formattedData?.tenantKey as string | undefined | null,
      )
      .filter((key) => !!key),
  )
}

function getTenantsToInsert(
  eligibleTenantKeys: ReadonlySet<M365TenantKey>,
  currentTenantKeys: ReadonlySet<string>,
): PartialModelObject<Connection>[] {
  const result: PartialModelObject<Connection>[] = []

  for (const tenantKey of eligibleTenantKeys.values()) {
    if (currentTenantKeys.has(tenantKey)) {
      continue
    }

    result.push({
      key: APP_KEY,
      formattedData: {
        tenantKey,
        screenName: getM365TenantInfo(tenantKey).label,
      },
      verified: false,
    })
  }

  return result
}

const getSystemAddedConnections: NonNullable<
  ISystemAddedConnectionAuth['getSystemAddedConnections']
> = async function (user) {
  // Safe to typecast this because it is always a User model object
  // FIXME (ogp-weeloong): Replace shared types with front-end specific typed
  // GraphQL so that we can directly store models in IGlobalVariable
  if (!(user instanceof User)) {
    throw new Error(
      'Invalid user object received by M365 getSystemAddedConnections',
    )
  }

  // FIXME (ogp-weeloong): consider locking user's connection rows in a later
  // PR to prevent concurrent creation of duplicate connections for same
  // tenants.
  const connections = await user
    .$relatedQuery('connections')
    .select('connections.*')
    .fullOuterJoinRelated('steps')
    .where({
      'connections.key': APP_KEY,
    })
    .countDistinct('steps.flow_id as flowCount')
    .groupBy('connections.id')
    .orderBy('created_at', 'desc')

  // Create connections for tenants which are not yet connected
  const eligibleTenantKeys = await getEligibleTenantKeys(user.email)
  const tenantsToInsert = getTenantsToInsert(
    eligibleTenantKeys,
    getCurrentTenantKeys(connections),
  )
  if (tenantsToInsert.length > 0) {
    const newConnections = await user
      .$relatedQuery('connections')
      .insertAndFetch(tenantsToInsert)
      .returning('*')

    for (const newConnection of newConnections) {
      newConnection.flowCount = 0
      connections.push(newConnection)
    }
  }

  // Note: we don't filter out currently ineligible tenants (i.e. user was
  // eligible for a tenant before, but lost it later) to prevent confusion.
  // Instead, when they test connection, they will see an error.
  return connections
}

export default getSystemAddedConnections
