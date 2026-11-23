import type { AnyQueryBuilder } from 'objection'

/**
 * Adds a `hasPublishedFlows` column to a connections query.
 *
 * IMPORTANT: The query must already `fullOuterJoinRelated('steps')` and
 * `groupBy('connections.id')`. This reuses that join, so it adds no
 * per-connection subquery. Keep the condition in sync with the published-pipe
 * guard in the deleteConnection mutation.
 */
export default function addHasPublishedFlows<QB extends AnyQueryBuilder>(
  query: QB,
): QB {
  return query
    .leftJoin('flows', (join) =>
      join
        .on('flows.id', 'steps.flow_id')
        .andOnNull('flows.deleted_at')
        .andOn('flows.active', query.knex().raw('true')),
    )
    .select(
      query
        .knex()
        .raw(
          'coalesce(bool_or(flows.id is not null and steps.deleted_at is null), false) as "hasPublishedFlows"',
        ),
    ) as QB
}
