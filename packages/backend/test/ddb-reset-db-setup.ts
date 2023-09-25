/* eslint-disable no-console */
import '../src/config/dynamodb'

import { afterEach } from 'vitest'

afterEach(async () => {
  // there isnt a good way to truncate all tables
  // but since there is no the mock tables are re-created each time,
  // there is no conflict in keys for table rows.
  // thus, we can just leave it there without truncating
})
