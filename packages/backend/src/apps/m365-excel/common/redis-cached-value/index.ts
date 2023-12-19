import type { IJSONValue } from '@plumber/types'

import { M365TenantInfo } from '@/config/app-env-vars/m365'
import { redisAppDataClient } from '@/helpers/redis-app-data'

import { makeRedisKey } from './make-redis-key'
import { runWithLockElseRetryStep } from './redlock'

interface RedisCachedValueCtorParams<T> {
  tenant: M365TenantInfo
  objectId: string
  cacheKey: string

  expirySeconds: number
  extendExpiryOnRead: boolean

  /**
   * Callback which queries the value from its source of truth. Used when
   * the cached value has expired, or when
   */
  queryValueFromSource: () => Promise<T>
}

/**
 * This class allows for caching a value in redis in a manner that tries to
 * minimize queries to the source of truth.
 *
 * Implementation notes
 * ===
 * 1. All writes / updates to redis are serialized with a distributed redis
 *    lock. This ensures that queryValueFromSource callback is not invoked more
 *    times than necessary.
 *
 * 2. Reads are not serialized (duh). However, if the cached value has expired
 *    or there is no cache hit, the synchronized update in point 2 will be
 *    triggered.
 *
 * 3. Data is stored in redis keys that follow the naming convention detailed in
 *     make-redis-key.ts.
 *
 *    - Additionally, this class reserves the ':redis-cached-value-lock` key
 *      suffix for storing a lock.
 *
 *      For example, if the caller caches a value in the `excel:worksheets` key,
 *      they should not use the `excel:worksheets:redis-cached-value-lock` key.
 *
 *    - It's up to the caller to ensure no key naming conflicts.
 *
 * 4. This does not allow permanent / non-expiring values, to prevent
 *    redis overconsumption.
 */
export class RedisCachedValue<T extends IJSONValue> {
  private redisKey: string
  private lockKey: string

  private expirySeconds: number
  private extendExpiryOnRead: boolean

  private queryValueFromSource: () => Promise<T>

  public constructor({
    tenant,
    objectId,
    cacheKey,

    expirySeconds,
    extendExpiryOnRead,

    queryValueFromSource,
  }: RedisCachedValueCtorParams<T>) {
    if (expirySeconds <= 0) {
      throw new Error('Redis cached value expiry must be > 0.')
    }

    this.redisKey = makeRedisKey(tenant, objectId, cacheKey)
    this.lockKey = `${this.redisKey}:redis-cached-value-lock`

    this.expirySeconds = expirySeconds
    this.extendExpiryOnRead = extendExpiryOnRead

    this.queryValueFromSource = queryValueFromSource
  }

  //
  // Public API
  //

  public async get(forceInvalidation = false): Promise<T> {
    const redisValueGetter = this.extendExpiryOnRead
      ? this._getFromRedisAndExtendExpiry
      : this._getFromRedis

    if (!forceInvalidation) {
      const valueInRedis = await redisValueGetter()
      if (valueInRedis) {
        return JSON.parse(valueInRedis)
      }
    }

    return await this._refreshCachedValue(redisValueGetter, forceInvalidation)
  }

  public async invalidateIfValueIs(expectedValue: T): Promise<void> {
    await runWithLockElseRetryStep(this.lockKey, async (signal) => {
      // Nothing to do if value is different.
      //
      // Note that we always use raw get without bumping expiry because expiries
      // should only ever be bumped on value read - but a clear isn't a read.
      const valueInRedis = await this._getFromRedis()
      if (valueInRedis !== expectedValue) {
        return
      }

      if (signal.aborted) {
        throw new Error(`Redis lock error: ${signal.reason}`)
      }

      await redisAppDataClient.del(this.redisKey)
    })
  }

  //
  // Implementation details
  //

  private async _refreshCachedValue(
    redisValueGetter:
      | typeof this._getFromRedis
      | typeof this._getFromRedisAndExtendExpiry,
    forceInvalidation: boolean,
  ): Promise<T> {
    return await runWithLockElseRetryStep(this.lockKey, async (signal) => {
      // If we're not forcing invalidation, then we must be calling this because
      // the data was not in redis when we tried to get it earlier (i.e. it has
      // expired, or we have never queried the data before).
      //
      // Since we serialize redis updates, when we enter the lock, it's possible
      // that someone else has already queried the value of interest and updated
      // redis for us already. So we check redis again at lock entry to see if
      // we can avoid making our query.
      if (!forceInvalidation) {
        // We abstract away redisValueGetter because we may need to extend
        // expiry on get.
        const valueInRedis = await redisValueGetter()
        if (valueInRedis) {
          return JSON.parse(valueInRedis)
        }

        if (signal.aborted) {
          throw new Error(`Redis lock error: ${signal.reason}`)
        }
      }

      const value = await this.queryValueFromSource()

      if (signal.aborted) {
        throw new Error(`Redis lock error: ${signal.reason}`)
      }

      await redisAppDataClient.set(
        this.redisKey,
        JSON.stringify(value),
        'EX',
        this.expirySeconds,
      )

      return value
    })
  }

  private async _getFromRedis(): Promise<string | null> {
    return await redisAppDataClient.get(this.redisKey)
  }

  private async _getFromRedisAndExtendExpiry(): Promise<string | null> {
    const [[getErr, valueInRedis], [expireErr]] = await redisAppDataClient
      .multi()
      .get(this.redisKey)
      .expire(this.redisKey, this.expirySeconds)
      .exec()

    if (getErr) {
      throw getErr
    }
    if (expireErr) {
      throw expireErr
    }

    return valueInRedis as string | null
  }
}
