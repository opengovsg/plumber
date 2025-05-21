/* eslint-disable no-undef */
import exec from 'k6/execution'
import sql from 'k6/x/sql'
import driver from 'k6/x/sql/driver/postgres'

// Test configuration
export const options = {
  discardResponseBodies: true,
  scenarios: {
    contacts: {
      executor: 'constant-arrival-rate',

      duration: '5m',

      rate: 100,

      // It should start `rate` iterations per second
      timeUnit: '10s',

      // It should preallocate 2 VUs before starting the test
      preAllocatedVUs: 100,

      // It is allowed to spin up to 50 maximum VUs to sustain the defined
      // constant arrival rate.
    },
  },
}

export default function () {
  const db = sql.open(driver, __ENV.POSTGRES_TILES_URL)
  const i = Math.floor(Math.random() * 30)
  db.exec(`
    SELECT * FROM "public"."load_test_table_${
      exec.vu.idInInstance
    }" ORDER BY "rowId" LIMIT 10000 OFFSET ${i * 10000};
  `)
  console.log(
    `read ${i * 10000} rows in load_test_table_${exec.vu.idInInstance}`,
  )

  db.close()
}
