/* eslint-disable no-undef */
import exec from 'k6/execution'
import sql from 'k6/x/sql'
import driver from 'k6/x/sql/driver/postgres'

// Test configuration
export const options = {
  iterations: 1000,
  vus: 1,
}

export default function () {
  const db = sql.open(driver, __ENV.POSTGRES_TILES_URL)
  const tableId = exec.vu.iterationInInstance

  db.exec(`
      CREATE TABLE IF NOT EXISTS "public"."load_test_table_${tableId}" (
      "rowId" varchar(255) NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ${Array.from({ length: 10 }, (_, i) => `"column${i}" text`).join(',\n')},
      PRIMARY KEY ("rowId")
  );
    `)
  console.log(`table created: load_test_table_${tableId}`)
  db.close()
}
