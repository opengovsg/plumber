import * as ddb from './ddb-global-setup'
import * as pg from './pg-global-setup'
import * as redis from './redis-global-setup'
import * as tilesPg from './tiles-pg-global-setup'

// Every integration project loads this file in its own module graph, but
// globalThis is shared. The projects reuse one set of containers. Only the
// module instance that started them holds the container handles.
type ContainersState = {
  users: number
  ready: Promise<void>
  stop: () => Promise<void>
}
const store = globalThis as typeof globalThis & {
  __plumberItestContainers?: ContainersState
}

async function stopContainers() {
  await Promise.all([
    pg.teardown(),
    tilesPg.teardown(),
    ddb.teardown(),
    redis.teardown(),
  ])
}

export async function setup() {
  if (!store.__plumberItestContainers) {
    // db.ts reads POSTGRES_PORT once, at import. DynamoDB setup imports the
    // app, so Postgres must publish its port before that import.
    const ready = (async () => {
      await pg.setup()
      await Promise.all([tilesPg.setup(), ddb.setup(), redis.setup()])
    })()
    store.__plumberItestContainers = {
      users: 0,
      ready,
      stop: stopContainers,
    }
  }
  store.__plumberItestContainers.users += 1
  await store.__plumberItestContainers.ready
}

export async function teardown() {
  const state = store.__plumberItestContainers
  if (!state) {
    return
  }
  state.users -= 1
  if (state.users > 0) {
    return
  }
  store.__plumberItestContainers = undefined
  await state.stop()
}
