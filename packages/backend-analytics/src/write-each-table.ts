import logger from './logger'

/**
 * Writes each table, so one failing table does not stop the others.
 *
 * Throws once at the end, naming every failed table, so the export alert still fires.
 */
export async function writeEachTable<Table extends { name: string }>(
  tables: Table[],
  write: (table: Table) => Promise<void>,
): Promise<void> {
  const failed: string[] = []
  for (const table of tables) {
    try {
      await write(table)
    } catch (err) {
      failed.push(table.name)
      logger.error({
        event: 'analytics.export.table.error',
        table: table.name,
        err,
      })
    }
  }
  if (failed.length > 0) {
    throw new Error(`Analytics tables failed: ${failed.join(', ')}`)
  }
}
