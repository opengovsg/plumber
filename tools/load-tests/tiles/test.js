/* eslint-disable no-undef */
import sql from 'k6/x/sql'
import driver from 'k6/x/sql/driver/postgres'

// Test configuration
export const options = {
  iterations: 1,
  vus: 1,
}

export default function () {
  const db = sql.open(driver, __ENV.POSTGRES_TILES_URL)
  const result = db.exec(`SELECT 1 as connection_test`)
  console.log(result.rowsAffected())
  db.close()
}
