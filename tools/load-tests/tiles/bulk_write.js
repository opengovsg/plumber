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

      duration: '5m',

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

const generatedRows = Array.from({ length: 1000 }, (_, i) => {
  return Array.from({ length: 10 }, (_, j) => {
    return `'row${i}-col${j}'`
  }).join(',')
})

export default function () {
  const db = sql.open(driver, __ENV.POSTGRES_TILES_URL)
  const result = db.exec(`
    INSERT INTO "public"."load_test_table_${
      exec.vu.idInInstance
    }" ("rowId", "column0", "column1", "column2", "column3", "column4", "column5", "column6", "column7", "column8", "column9") VALUES ${generatedRows
    .map((row) => `('${crypto.randomUUID()}', ${row})`)
    .join(',\n')};
  `)
  // const result = db.exec(`
  //   SELECT 1 FROM "public"."load_test_table_${exec.vu.idInInstance}";
  // `)
  check(result, 'is added', (r) => r.rowsAffected() === 1000)
  console.log(
    `added ${result.rowsAffected()} rows in load_test_table_${
      exec.vu.idInInstance
    }`,
  )
  db.close()
}
