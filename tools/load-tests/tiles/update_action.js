/* eslint-disable no-undef */
import { check } from 'k6'
import exec from 'k6/execution'
import sql from 'k6/x/sql'
import driver from 'k6/x/sql/driver/postgres'

// Test configuration
export const options = {
  discardResponseBodies: true,
  scenarios: {
    contacts: {
      executor: 'constant-arrival-rate',

      duration: '10m',

      rate: 50,

      // It should start `rate` iterations per second
      timeUnit: '1s',

      // It should preallocate 2 VUs before starting the test
      preAllocatedVUs: 100,

      // It is allowed to spin up to 50 maximum VUs to sustain the defined
      // constant arrival rate.
      maxVUs: 100,
    },
  },
}

export default function () {
  const db = sql.open(driver, __ENV.POSTGRES_TILES_URL)
  const result = db.exec(`
    UPDATE "public"."load_test_table_${exec.vu.idInInstance}" SET "column2" = 'updated' WHERE "rowId" = 'to update';
  `)

  check(result, 'is added', (r) => r.rowsAffected() === 1)
  console.log(
    `added ${result.rowsAffected()} rows in load_test_table_${
      exec.vu.idInInstance
    }`,
  )
  db.close()
}
