import * as ddb from './ddb-global-setup'
import * as pg from './pg-global-setup'
import * as redis from './redis-global-setup'
import * as tilesPg from './tiles-pg-global-setup'

export async function setup() {
  await Promise.all([pg.setup(), tilesPg.setup(), ddb.setup(), redis.setup()])
}

export async function teardown() {
  await Promise.all([
    pg.teardown(),
    tilesPg.teardown(),
    ddb.teardown(),
    redis.teardown(),
  ])
}
